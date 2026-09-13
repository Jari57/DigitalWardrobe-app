'use client';
import { useEffect, useState } from 'react';
import { Bookmark, Heart, SlidersHorizontal, Sparkles, ArrowUpRight, Shirt } from 'lucide-react';
import { api } from './ui';
import {
  defaultPreferences,
  styleChoices,
  typeChoices,
  type FeedItem,
  type Preferences,
} from '@/lib/for-you';
type Response = {
  items: FeedItem[];
  preferences: Preferences;
  authenticated: boolean;
  checkedAt: string | null;
  sourcesUnavailable: boolean;
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
}: {
  onAuth: () => void;
  onStyle: (aesthetic: string) => void;
}) {
  const [data, setData] = useState<Response>();
  const [mode, setMode] = useState('for-you'),
    [revision, setRevision] = useState(0);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [hidden, setHidden] = useState<string>();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<Response>(`/api/for-you?mode=${mode}`)
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
  }, [mode, revision]);
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
            Region guides shopping searches. Fashion coverage currently comes from US/UK publishers.
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
            disabled={busy}
            onClick={() => setMode(value)}
          >
            {label}
          </button>
        ))}
      </div>
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
      {loading ? (
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
                  className="primary compact"
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
                <a
                  className="feed-shop"
                  href={`https://www.google.com/search?tbm=shop&gl=${data.preferences.region === 'GB' ? 'uk' : data.preferences.region.toLowerCase()}&q=${encodeURIComponent([...item.aesthetics, ...item.categories, 'clothing'].join(' '))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Find pieces <ArrowUpRight size={14} />
                </a>
              </div>
              <details>
                <summary>Why this?</summary>
                <p>{item.reason}. Fashion coverage, not a verified viral ranking.</p>
                <small>
                  Photo: {item.imageCredit || item.publisher}. Shopping opens an external search;
                  availability is not verified.
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
