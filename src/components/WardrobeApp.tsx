'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Camera,
  Check,
  Grid2X2,
  Layers,
  Plus,
  Search,
  Shirt,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { Garment, Piece, User, Wardrobe, Outfit } from '@/lib/types';
import AiAllowance from './AiAllowance';
import CreatorDialog from './CreatorDialog';
import AccountDialog from './AccountDialog';
import AccountSettings from './AccountSettings';
import GarmentDialog from './GarmentDialog';
import OutfitCanvas, { Board } from './OutfitCanvas';
import BlindFit from './BlindFit';
import ThemeToggle from './ThemeToggle';
import Spotter from './Spotter';
import ForYouFeed from './ForYouFeed';
import StudioResume from './StudioResume';
import SectionTip from './SectionTip';
import { api, categories, Empty } from './ui';
const blank: Wardrobe = { garments: [], outfits: [], references: [] };
const tabs = [
  { id: 'Spotter', label: 'Find', icon: Camera },
  { id: 'Closet', label: 'My Closet', icon: Shirt },
  { id: 'Looks', label: 'Saved', icon: Grid2X2 },
] as const;
export default function WardrobeApp({
  initialAccountOpen = false,
}: {
  initialAccountOpen?: boolean;
}) {
  const [user, setUser] = useState<User | null>(null),
    [data, setData] = useState<Wardrobe>(blank),
    [tab, setTab] = useState<string>('Spotter'),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [account, setAccount] = useState(initialAccountOpen),
    [accountMode, setAccountMode] = useState<'auth' | 'settings'>('auth'),
    [editing, setEditing] = useState<Garment | null | undefined>(undefined),
    [blind, setBlind] = useState(false),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [color, setColor] = useState('all'),
    [pieces, setPieces] = useState<Piece[]>([]);
  const [creatorOutfit, setCreatorOutfit] = useState<Outfit | null>(null);
  const [spotterSession, setSpotterSession] = useState(0);
  const [feedPhoto, setFeedPhoto] = useState<File | null>(null);
  const screenshotInput = useRef<HTMLInputElement>(null);
  const [creatorAesthetic, setCreatorAesthetic] = useState('Minimal');
  const [styleLock, setStyleLock] = useState<string>();
  const [feedMode, setFeedMode] = useState('for-you');
  const [pendingAction, setPendingAction] = useState<'add' | null>(null);
  useEffect(() => {
    if (pendingAction && user && !account) {
      setPendingAction(null);
      setTab('Closet');
      setEditing(null);
    }
  }, [pendingAction, user, account]);
  const refresh = useCallback(async () => {
    const wardrobe = await api<Wardrobe>('/api/wardrobe');
    setData(wardrobe);
    setPieces((current) =>
      current.filter((p) => wardrobe.garments.some((g) => g.id === p.garmentId)),
    );
  }, []);
  const session = useCallback(async () => {
    const result = await api<{ user: User | null }>('/api/session');
    setUser(result.user);
    if (result.user) await refresh();
    else {
      setData(blank);
      setPieces([]);
    }
  }, [refresh]);
  useEffect(() => {
    session()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);
  useEffect(() => {
    if (user?.id) void api('/api/journey', 'POST', { event: 'visit' }).catch(() => {});
  }, [user?.id]);
  function add() {
    if (user) setEditing(null);
    else {
      setPendingAction('add');
      setAccountMode('auth');
      setAccount(true);
    }
  }
  function styleMyClothes() {
    setTab('Closet');
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (user && data.garments.length) setBlind(true);
  }
  const activeTab = ['Canvas', 'Stats'].includes(tab)
    ? 'Closet'
    : tab === 'For You'
      ? feedMode === 'saved'
        ? 'Looks'
        : 'Spotter'
      : tab;
  function navigate(next: string) {
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  const visible = data.garments.filter(
    (g) =>
      (category === 'all' || g.category === category) &&
      (color === 'all' || g.color === color) &&
      [g.name, g.brand, g.color, g.category].join(' ').toLowerCase().includes(query.toLowerCase()),
  );
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const wearTotal = data.garments.reduce((sum, g) => sum + g.wearCount, 0),
    value = data.garments.reduce((sum, g) => sum + (g.price || 0), 0);
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand-kicker">
            <span />
            SCREENSHOT TO SHOPPING
          </div>
          <h1 className="brand-wordmark">
            <img src="/icons/icon-192.png" alt="" width="32" height="32" />
            FitStalker
          </h1>
        </div>
        <div className="row">
          <ThemeToggle />
          <button
            aria-label={user ? 'Account settings' : 'Sign in'}
            className={user ? 'icon-button' : 'compact'}
            disabled={busy || loading}
            onClick={() => {
              setPendingAction(null);
              setAccountMode(user ? 'settings' : 'auth');
              setAccount(true);
            }}
          >
            <UserRound size={18} />
            {!user && 'Sign in'}
          </button>
        </div>
      </header>
      <nav className="bottom-nav" aria-label="Main navigation">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => navigate(id)}
          >
            <Icon size={21} strokeWidth={activeTab === id ? 2.4 : 1.7} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <main id="main-content" className="main-content">
        {user && tab !== 'Spotter' && <AiAllowance key={user.id} />}
        {user && tab !== 'Spotter' && (
          <div className="account-line">
            @{user.username}
            <span>Private closet</span>
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
            <button className="text-button" onClick={() => action(session)}>
              Retry connection
            </button>
          </div>
        )}
        {notice && (
          <p className="success" role="status">
            {notice}
          </p>
        )}
        {loading ? (
          <div className="empty" role="status">
            Opening your wardrobe…
          </div>
        ) : (
          <>
            {tab !== 'Spotter' && <SectionTip tab={tab} />}
            {['Canvas', 'Stats', 'For You'].includes(tab) && (
              <button className="text-button section-back" onClick={() => navigate(activeTab)}>
                ← Back to {tabs.find((entry) => entry.id === activeTab)?.label}
              </button>
            )}
            {tab === 'Closet' && (
              <>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">STYLE WHAT YOU OWN</span>
                    <h2>My closet</h2>
                    <p>Add your clothes. Tell us your plans. Get an outfit.</p>
                  </div>
                </div>
                {data.garments.length > 0 && (
                  <>
                    <div className="row wrap">
                      <button className="primary" onClick={styleMyClothes}>
                        <Sparkles size={16} />
                        Style my clothes
                      </button>
                      <button onClick={add}>
                        <Plus size={16} />
                        Add an item
                      </button>
                    </div>
                    <details className="closet-tools">
                      <summary>More closet tools</summary>
                      <div className="row wrap">
                        <button onClick={() => setTab('Canvas')}>
                          <Layers size={16} />
                          Outfit canvas
                        </button>
                        <button onClick={() => setTab('Stats')}>
                          <BarChart3 size={16} />
                          Closet stats
                        </button>
                      </div>
                    </details>
                    <details className="closet-filters">
                      <summary>Search &amp; filter items</summary>
                      <div className="search-box">
                        <Search size={17} />
                        <input
                          aria-label="Search closet"
                          placeholder="Search brand, category, color…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </div>
                      <div className="category-pills">
                        <button
                          aria-pressed={category === 'all'}
                          onClick={() => setCategory('all')}
                        >
                          All ({data.garments.length})
                        </button>
                        {categories.map((c) => (
                          <button
                            key={c}
                            aria-pressed={category === c}
                            onClick={() => setCategory(c)}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                      <div className="palette">
                        <label htmlFor="palette">PALETTE</label>
                        <select
                          id="palette"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                        >
                          <option value="all">Any color</option>
                          {Array.from(new Set(data.garments.map((g) => g.color)))
                            .sort()
                            .map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                        </select>
                      </div>
                    </details>
                  </>
                )}
                {!data.garments.length ? (
                  <section className="closet-start stack" aria-label="Start your closet">
                    <Shirt size={32} aria-hidden="true" />
                    <h3>Start with one item you love.</h3>
                    <p>
                      Photograph a top, bottoms or shoes. Add a few items to start creating outfits.
                    </p>
                    <ol className="closet-start-steps">
                      <li>Add a photo of one item.</li>
                      <li>Check its details and save.</li>
                      <li>Choose “Style my clothes” and tell us your plans.</li>
                    </ol>
                    {!user && (
                      <p>
                        Sign in when you add an item to keep your closet private. We’ll bring you
                        straight back.
                      </p>
                    )}
                    <button className="primary" onClick={add}>
                      <Plus size={17} />
                      Add your first item
                    </button>
                  </section>
                ) : !visible.length ? (
                  <Empty
                    title="No pieces found"
                    action={
                      <button
                        onClick={() => {
                          setQuery('');
                          setCategory('all');
                          setColor('all');
                        }}
                      >
                        Clear filters
                      </button>
                    }
                  >
                    Try a different search or palette.
                  </Empty>
                ) : (
                  <div className="garment-grid">
                    {visible.map((g) => (
                      <article className="garment-card" key={g.id}>
                        <button
                          className="garment-photo"
                          onClick={() => setEditing(g)}
                          aria-label={`Edit ${g.name}`}
                        >
                          <img src={g.imageUrl} alt={g.name} />
                          <span className="photo-badge">{g.color}</span>
                        </button>
                        <div className="card-info">
                          <small>{g.brand || g.category}</small>
                          <h3>{g.name}</h3>
                          <div className="row between">
                            <span className="wear-label">{g.wearCount} wears</span>
                            <button
                              className="icon-button"
                              aria-label={`Style ${g.name}`}
                              onClick={() => {
                                if (!pieces.some((p) => p.garmentId === g.id) && pieces.length < 12)
                                  setPieces([
                                    ...pieces,
                                    {
                                      garmentId: g.id,
                                      x: 33,
                                      y: 25,
                                      scale: 1,
                                      zIndex: pieces.length,
                                    },
                                  ]);
                                setTab('Canvas');
                              }}
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
            {tab === 'For You' && (
              <ForYouFeed
                initialMode={feedMode}
                onIdentify={(photo) => {
                  setFeedPhoto(photo);
                  setTab('Spotter');
                  window.scrollTo({ top: 0, behavior: 'auto' });
                }}
                key={`${user?.id ?? 'guest'}:${feedMode}`}
                onAuth={() => {
                  setAccountMode('auth');
                  setAccount(true);
                }}
                onStyle={(aesthetic) => {
                  setCreatorAesthetic(aesthetic);
                  styleMyClothes();
                }}
              />
            )}
            <div id="stalk-fit" hidden={tab !== 'Spotter'}>
              <Spotter
                screenshotInput={screenshotInput}
                key={spotterSession}
                onStyleSaved={(id) => {
                  setStyleLock(id);
                  setBlind(true);
                }}
                onOpenCloset={() => {
                  setTab('Closet');
                  window.scrollTo({ top: 0, behavior: 'auto' });
                }}
                initialPhoto={feedPhoto}
                onPhotoReceived={() => setFeedPhoto(null)}
                onUse={(p) => {
                  setPieces(p);
                  setTab('Canvas');
                }}
                garments={data.garments}
                references={data.references}
                onRefresh={refresh}
                onAuth={() => {
                  setAccountMode('auth');
                  setAccount(true);
                }}
                authenticated={!!user}
              />
              <section className="find-next" aria-label="More ways to use FitStalker">
                <button onClick={styleMyClothes}>
                  <Shirt size={18} />
                  Style my clothes
                </button>
                <button
                  onClick={() => {
                    setFeedMode('for-you');
                    navigate('For You');
                  }}
                >
                  <Sparkles size={18} />
                  Browse style ideas
                </button>
              </section>
              {user && (
                <StudioResume
                  key={user.id}
                  onDraft={(draft) => {
                    setPieces(draft.filter((p) => data.garments.some((g) => g.id === p.garmentId)));
                    setTab('Canvas');
                  }}
                  onSaved={() => {
                    setFeedMode('saved');
                    setTab('For You');
                  }}
                  onLooks={() => setTab('Looks')}
                />
              )}
            </div>
            {tab === 'Canvas' &&
              (data.garments.length ? (
                <OutfitCanvas
                  garments={data.garments}
                  pieces={pieces}
                  setPieces={setPieces}
                  onSaved={refresh}
                  onSaveDraft={async () => {
                    await api('/api/experience', 'PATCH', { kind: 'draft', pieces });
                    window.dispatchEvent(new Event('wardrobe-draft-updated'));
                  }}
                />
              ) : (
                <Empty
                  title="A blank canvas. Endless possibilities."
                  action={
                    <button className="primary" onClick={add}>
                      Add your first item
                    </button>
                  }
                >
                  Bring in your clothes to start arranging and exporting your own outfit boards.
                </Empty>
              ))}
            {tab === 'Looks' && (
              <div className="stack">
                <div className="section-heading">
                  <div>
                    <h2>Saved outfits</h2>
                    <p>Your favorite outfits, ready to wear again.</p>
                  </div>
                  <span className="count-badge">{data.outfits.length}</span>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    setFeedMode('saved');
                    navigate('For You');
                  }}
                >
                  View saved style ideas
                </button>
                {!data.outfits.length ? (
                  <Empty
                    title="Your outfits will appear here"
                    action={
                      <button className="primary" onClick={styleMyClothes}>
                        Style my clothes
                      </button>
                    }
                  >
                    Create an outfit from your closet, then save it for next time.
                  </Empty>
                ) : (
                  data.outfits.map((o) => (
                    <article className="look-card" key={o.id}>
                      <Board garments={data.garments} pieces={o.pieces} />
                      <div className="stack">
                        <h3>{o.name}</h3>
                        <div className="row wrap">
                          <button
                            onClick={() => {
                              setPieces(o.pieces);
                              setTab('Canvas');
                            }}
                          >
                            Edit a copy
                          </button>
                          <button onClick={() => setCreatorOutfit(o)}>Create content</button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              action(async () => {
                                const d = new Date(),
                                  date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                await api(`/api/outfits/${o.id}/wear`, 'POST', { date });
                                await refresh();
                                setNotice(
                                  "Today's wear recorded. Each look can be logged once per day.",
                                );
                              })
                            }
                          >
                            <Check size={16} />
                            Wore today
                          </button>
                          <button
                            className="text-button danger"
                            disabled={busy}
                            onClick={() => {
                              if (confirm(`Delete “${o.name}”?`))
                                action(async () => {
                                  await api(`/api/outfits/${o.id}`, 'DELETE');
                                  await refresh();
                                });
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}
            {tab === 'Stats' && (
              <div className="stack">
                <div className="section-heading">
                  <div>
                    <h2>Know your wardrobe</h2>
                    <p>More wears. More possibilities.</p>
                  </div>
                </div>
                <div className="stats-grid">
                  <div>
                    <span>Closet pieces</span>
                    <strong>{data.garments.length}</strong>
                  </div>
                  <div>
                    <span>Saved looks</span>
                    <strong>{data.outfits.length}</strong>
                  </div>
                  <div>
                    <span>Piece wears</span>
                    <strong>{wearTotal}</strong>
                  </div>
                  <div>
                    <span>Recorded value</span>
                    <strong>
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0,
                      }).format(value)}
                    </strong>
                  </div>
                </div>
                <p className="note">
                  Value includes only prices you enter. Wear counts come from the looks you log
                  wearing.
                </p>
                <h3>Your most-worn pieces</h3>
                {!wearTotal ? (
                  <Empty title="Make every piece count">
                    Tap “Wore today” on a saved look to see your rotation and cost per wear.
                  </Empty>
                ) : (
                  <div className="stack">
                    {[...data.garments]
                      .filter((g) => g.wearCount > 0)
                      .sort((a, b) => b.wearCount - a.wearCount)
                      .map((g) => (
                        <div className="stat-piece" key={g.id}>
                          <img src={g.imageUrl} alt="" />
                          <div>
                            <strong>{g.name}</strong>
                            <small>
                              {g.wearCount} wears
                              {g.price !== null
                                ? ` · $${(g.price / g.wearCount).toFixed(2)} per wear`
                                : ''}
                            </small>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {account &&
        (accountMode === 'settings' && user ? (
          <AccountSettings
            user={user}
            onClose={() => setAccount(false)}
            onSignedOut={() => {
              // Clear private scan state, while retaining guest uploads through sign-in.
              setSpotterSession((current) => current + 1);
              setFeedPhoto(null);
              setStyleLock(undefined);
              setBlind(false);
              setCreatorOutfit(null);
              setEditing(undefined);
              setPendingAction(null);
              setAccount(false);
              setUser(null);
              setData(blank);
              setPieces([]);
              setQuery('');
              setCategory('all');
              setColor('all');
              setTab('Spotter');
              setError('');
              setNotice('');
            }}
          />
        ) : (
          <AccountDialog
            intent={
              pendingAction === 'add'
                ? 'Sign in to save your first item. Your closet stays private, and the add-item form opens next.'
                : undefined
            }
            onDismiss={() => setPendingAction(null)}
            onClose={() => setAccount(false)}
            onAuthenticated={session}
          />
        ))}
      {editing !== undefined && (
        <GarmentDialog
          garment={editing || undefined}
          onClose={() => setEditing(undefined)}
          onSaved={refresh}
        />
      )}
      {creatorOutfit && (
        <CreatorDialog
          outfit={creatorOutfit}
          garments={data.garments}
          onClose={() => setCreatorOutfit(null)}
        />
      )}
      {blind && (
        <BlindFit
          onSaved={refresh}
          onAdd={() => {
            setBlind(false);
            add();
          }}
          initialLockedId={styleLock}
          initialAesthetic={creatorAesthetic}
          garments={data.garments}
          onClose={() => {
            setBlind(false);
            setStyleLock(undefined);
          }}
          onUse={(p) => {
            setPieces(p);
            setBlind(false);
            setStyleLock(undefined);
            setTab('Canvas');
          }}
        />
      )}
    </div>
  );
}
