'use client';
import { useEffect, useState } from 'react';
import {
  Bookmark,
  Heart,
  SlidersHorizontal,
  Sparkles,
  ArrowUpRight,
  Shirt,
  RefreshCw,
} from 'lucide-react';
import { api } from './ui';
import {
  defaultPreferences,
  styleChoices,
  typeChoices,
  type FeedItem,
  type Preferences,
  selectedAudience,
  setAudience,
  type StyleAudience,
} from '@/lib/for-you';
type Response = {
  items: FeedItem[];
  preferences: Preferences;
  authenticated: boolean;
  checkedAt: string | null;
  sourcesUnavailable: boolean;
  stale?: boolean;
  attemptedAt?: string | null;
  sources?: { name: string; status: string }[];
};
function Photo({ item }: { item: FeedItem }) {
  const [failed, setFailed] = useState(false);
  return item.imageUrl && !failed ? (
    <img
      className="feed-photo"
      src={item.imageUrl}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="feed-photo feed-photo-fallback">
      <Shirt size={56} strokeWidth={1} />
      <span>Explore the look</span>
    </div>
  );
}
export default function ForYouFeed({
  onAuth,
  onStyle,
  onIdentify,
  initialMode = 'for-you',
}: {
  onAuth: () => void;
  onStyle: (aesthetic: string) => void;
  onIdentify: (photo: File) => void;
  initialMode?: string;
}) {
  const [data, setData] = useState<Response>();
  const [mode, setMode] = useState(initialMode),
    [revision, setRevision] = useState(0);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [hidden, setHidden] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState('');
  const [audienceOverride, setAudienceOverride] = useState<StyleAudience>();
  const feedUrl = `/api/for-you?mode=${mode}${audienceOverride ? `&audience=${audienceOverride}` : ''}`;
  async function chooseAudience(audience: StyleAudience) {
    const next = setAudience(preferences, audience);
    setBusy(true);
    setError('');
    try {
      if (data?.authenticated) await api('/api/for-you/preferences', 'PUT', next);
      setPreferences(next);
      setAudienceOverride(audience);
      setRevision((value) => value + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let lastCheck = Date.now();
    const check = () => {
      if (
        !editing &&
        !busy &&
        !refreshing &&
        document.visibilityState === 'visible' &&
        Date.now() - lastCheck > 60000
      ) {
        lastCheck = Date.now();
        setRevision((n) => n + 1);
      }
    };
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, 5 * 60000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
    };
  }, [editing, busy, refreshing]);
  async function refreshFeed() {
    setRefreshing(true);
    setError('');
    setRefreshNote('');
    try {
      if (data?.authenticated) await api('/api/for-you', 'POST');
      const next = await api<Response>(feedUrl);
      const previousIds = new Set(data?.items.map((item) => item.id));
      const added = next.items.filter((item) => !previousIds.has(item.id)).length;
      setData(next);
      setRefreshNote(
        next.sourcesUnavailable || next.stale
          ? 'Some publishers are unavailable. Your saved ideas are still here.'
          : added
            ? `${added} new ideas added.`
            : 'You are up to date. No new stories since your last check.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<Response>(feedUrl)
      .then((value) => {
        if (active) {
          setData(value);
          setPreferences(value.preferences);
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [feedUrl, revision]);
  async function feedback(itemId: string, action: string) {
    if (!data?.authenticated) {
      onAuth();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/api/for-you/feedback', 'POST', { itemId, action });
      setHidden(action === 'hide' ? itemId : undefined);
      setRevision((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function identify(item: FeedItem) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/for-you/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.error || 'This photo could not be opened. Upload a screenshot instead.',
        );
      }
      onIdentify(new File([await response.blob()], 'for-you-look.webp', { type: 'image/webp' }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack for-you" aria-label="For You feed">
      <div className="row between">
        <div>
          <span className="eyebrow">YOUR NEXT STYLE OBSESSION</span>
          <h2>For You</h2>
          <p>Fresh finds. Your kind of style.</p>
        </div>
        <button
          className="icon-button"
          aria-label="Edit interests"
          aria-expanded={editing}
          disabled={loading || busy}
          onClick={() => setEditing(!editing)}
        >
          <SlidersHorizontal size={20} />
        </button>
      </div>
      {mode !== 'saved' && (
        <fieldset className="feed-audience">
          <legend>What do you want to see?</legend>
          <div className="row wrap">
            {(
              [
                ['womenswear', 'Womenswear'],
                ['menswear', 'Menswear'],
                ['all-styles', 'Both'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className="feed-chip"
                disabled={loading || busy || refreshing}
                aria-pressed={selectedAudience(preferences) === value}
                onClick={() => chooseAudience(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <small>Choose your style interests. You can change this anytime.</small>
        </fieldset>
      )}
      {editing && (
        <form
          className="trend-card stack"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!data?.authenticated) {
              onAuth();
              return;
            }
            setBusy(true);
            setError('');
            try {
              await api('/api/for-you/preferences', 'PUT', preferences);
              setEditing(false);
              setRevision((n) => n + 1);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Make it yours</h3>
          <p>Pick your styles and the pieces you love.</p>
          {(['aesthetics', 'categories'] as const).map((kind) => (
            <fieldset key={kind}>
              <legend>{kind === 'aesthetics' ? 'Your vibe' : 'Your pieces'}</legend>
              <div className="row wrap">
                {(kind === 'aesthetics' ? styleChoices : typeChoices).map((choice) => (
                  <button
                    className="feed-chip"
                    key={choice}
                    type="button"
                    aria-pressed={preferences[kind].includes(choice as never)}
                    onClick={() =>
                      setPreferences((previous) => ({
                        ...previous,
                        [kind]: previous[kind].includes(choice as never)
                          ? previous[kind].filter((value) => value !== choice)
                          : [...previous[kind], choice],
                      }))
                    }
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <label>
            Shopping region
            <select
              value={preferences.region}
              onChange={(e) =>
                setPreferences({ ...preferences, region: e.target.value as Preferences['region'] })
              }
            >
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
            </select>
          </label>
          <small>
            Region guides shopping searches. Coverage comes from a mix of international fashion
            publishers.
          </small>
          <button className="primary" disabled={busy || loading}>
            {busy ? 'Saving…' : 'Save interests'}
          </button>
        </form>
      )}
      <div className="row" aria-label="Feed views">
        {[
          ['for-you', 'For you'],
          ['latest', 'Latest'],
          ['saved', 'Saved'],
        ].map(([value, label]) => (
          <button
            key={value}
            className="feed-chip"
            aria-pressed={mode === value}
            disabled={busy || refreshing}
            onClick={() => setMode(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {mode !== 'saved' && (
        <div className="row between feed-refresh">
          <small>
            {data?.stale
              ? 'Updates delayed'
              : data?.checkedAt
                ? `Updated ${new Date(data.checkedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                : 'Checking for fresh ideas'}
          </small>
          <button
            className="compact"
            disabled={refreshing || loading || busy}
            onClick={refreshFeed}
          >
            <RefreshCw size={15} />
            {refreshing ? 'Refreshing…' : 'Refresh feed'}
          </button>
        </div>
      )}
      {refreshNote && <p role="status">{refreshNote}</p>}
      {data?.sources && mode !== 'saved' && (
        <details className="feed-sources">
          <summary>
            Explore our sources (
            {data.sources.filter((source) => source.status === 'available').length} with current
            stories)
          </summary>
          <ul>
            {data.sources.map((source) => (
              <li key={source.name}>
                {source.name} —{' '}
                {source.status === 'available'
                  ? 'Current stories available'
                  : source.status === 'unavailable'
                    ? 'Temporarily unavailable'
                    : source.status === 'pending'
                      ? 'First check pending'
                      : 'No current stories in this selection'}
              </li>
            ))}
          </ul>
        </details>
      )}
      {!data?.authenticated && !loading && (
        <button className="text-button" onClick={onAuth}>
          Sign in to make this feed yours
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error} <button onClick={() => setRevision((n) => n + 1)}>Try again</button>
        </p>
      )}
      {hidden && (
        <p role="status">
          Hidden from your feed.{' '}
          <button className="text-button" disabled={busy} onClick={() => feedback(hidden, 'show')}>
            Undo
          </button>
        </p>
      )}
      {loading && !data ? (
        <div className="feed-loading" role="status">
          Finding your next look…
        </div>
      ) : !data?.items.length ? (
        <div className="empty">
          <Bookmark size={28} />
          <h3>
            {mode === 'saved' ? 'Your next obsessions live here' : 'Fresh ideas are on their way'}
          </h3>
          <p>
            {mode === 'saved'
              ? 'Save a find to come back to it.'
              : 'Try Latest or adjust your interests.'}
          </p>
        </div>
      ) : (
        data.items.map((item) => (
          <article className="feed-card" key={item.id}>
            <div className="feed-image-wrap">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Read ${item.title}`}
              >
                <Photo item={item} />
              </a>
              <button
                className="feed-save icon-button"
                aria-label={item.saved ? 'Unsave idea' : 'Save idea'}
                aria-pressed={item.saved}
                disabled={busy}
                onClick={() => feedback(item.id, item.saved ? 'unsave' : 'save')}
              >
                <Bookmark size={20} fill={item.saved ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="feed-copy stack">
              <div className="row between">
                <span className="eyebrow">
                  {item.publisher} ·{' '}
                  {new Date(item.publishedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <button
                  className="icon-button"
                  aria-label={item.liked ? 'Unlike idea' : 'Like idea'}
                  aria-pressed={item.liked}
                  disabled={busy}
                  onClick={() => feedback(item.id, item.liked ? 'unlike' : 'like')}
                >
                  <Heart size={20} fill={item.liked ? 'currentColor' : 'none'} />
                </button>
              </div>
              <h3>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              </h3>
              <div className="row wrap">
                <button
                  className="compact"
                  onClick={() =>
                    onStyle(
                      item.aesthetics.length
                        ? item.aesthetics.join(' / ')
                        : item.categories.length
                          ? `${item.categories.join(' / ')} inspired look`
                          : 'Fresh fashion inspiration',
                    )
                  }
                >
                  <Sparkles size={15} />
                  Try the vibe
                </button>
                <button
                  className="primary compact"
                  disabled={busy || !item.imageUrl}
                  onClick={() => identify(item)}
                >
                  {busy ? 'Opening…' : 'Identify this look'} <ArrowUpRight size={14} />
                </button>
              </div>
              <details>
                <summary>Why this?</summary>
                <p>{item.reason}. Fashion coverage, not a verified viral ranking.</p>
                <small>
                  Photo: {item.imageCredit || item.publisher}. Identify this look opens its photo
                  for review. Scan it to find similar pieces; exact identity and availability are
                  not guaranteed.
                </small>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => feedback(item.id, 'hide')}
                >
                  Not interested
                </button>
              </details>
            </div>
          </article>
        ))
      )}
      {data?.checkedAt && (
        <small>
          Checked {new Date(data.checkedAt).toLocaleString()}
          {data.sourcesUnavailable ? ' · Some sources are temporarily unavailable.' : ''}
        </small>
      )}
    </section>
  );
}
