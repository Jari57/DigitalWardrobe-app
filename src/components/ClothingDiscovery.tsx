'use client';
import { useEffect, useRef, useState } from 'react';
import { ScanLine, ArrowUpRight } from 'lucide-react';
import type { Detection, DetectedItem, ShoppingResult, SearchPreferences } from '@/lib/discovery';
import type { ShoppingPreferences } from '@/lib/experience';
import { shoppingResultKey } from '@/lib/discovery';
import { api, categories, Modal, upload } from './ui';

export default function ClothingDiscovery({
  authenticated,
  onAuth,
  onRefresh,
  inspirationImage,
  initialPhoto,
  onPhotoReceived,
  onOpenCloset,
  onStyleSaved,
}: {
  authenticated: boolean;
  onAuth: () => void;
  onRefresh: () => Promise<void>;
  inspirationImage?: string;
  initialPhoto?: File | null;
  onPhotoReceived?: () => void;
  onOpenCloset?: () => void;
  onStyleSaved?: (id: string) => void;
}) {
  const [recent, setRecent] = useState<Detection[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [shopping, setShopping] = useState<Record<string, ShoppingResult>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [searchHistory, setSearchHistory] = useState<ShoppingResult[]>([]);
  const [preferences, setPreferences] = useState<SearchPreferences>();
  const [searchSettings, setSearchSettings] = useState<
    Record<string, SearchPreferences | undefined>
  >({});
  const [searchErrors, setSearchErrors] = useState<Record<string, string>>({});
  const [country, setCountry] = useState('US');
  const countryChosen = useRef(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!initialPhoto) return;
    setPhoto(initialPhoto);
    setUploaded('');
    setDetection(null);
    setError('');
    onPhotoReceived?.();
  }, [initialPhoto, onPhotoReceived]);
  useEffect(() => {
    if (!photo) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const [uploaded, setUploaded] = useState('');
  const [edit, setEdit] = useState<DetectedItem | null>(null);
  const [saved, setSaved] = useState('');
  const [savedGarmentId, setSavedGarmentId] = useState<string>();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    const load = () =>
      api<{ preferences: ShoppingPreferences }>('/api/experience')
        .then(({ preferences: p }) => {
          if (active) {
            setPreferences(
              p.maxPrice || p.sizes
                ? { currency: p.currency, maxPrice: p.maxPrice, sizes: p.sizes }
                : undefined,
            );
            if (!countryChosen.current) setCountry(p.region);
          }
        })
        .catch(() => {});
    void load();
    window.addEventListener('shopping-preferences-updated', load);
    return () => {
      active = false;
      window.removeEventListener('shopping-preferences-updated', load);
    };
  }, [authenticated]);
  useEffect(() => {
    const token = new URL(location.href).searchParams.get('share');
    if (!token) return;
    const channel = new MessageChannel();
    let finished = false;
    const finish = (file?: File) => {
      if (finished) return;
      finished = true;
      const url = new URL(location.href);
      url.searchParams.delete('share');
      history.replaceState(history.state, '', url);
      if (file) setPhoto(file);
      else setError('That share could not be opened. Upload your screenshot below.');
      channel.port1.close();
    };
    const start = setTimeout(() => {
      if (token === 'unavailable' || !navigator.serviceWorker?.controller) {
        finish();
        return;
      }
      channel.port1.onmessage = (event) =>
        finish(event.data.file instanceof File ? event.data.file : undefined);
      navigator.serviceWorker.controller.postMessage({ type: 'TAKE_SCREENSHOT', token }, [
        channel.port2,
      ]);
    }, 0);
    const timeout = setTimeout(() => finish(), 4000);
    return () => {
      finished = true;
      clearTimeout(start);
      clearTimeout(timeout);
      channel.port1.close();
    };
  }, []);
  useEffect(() => {
    if (inspirationImage) {
      setUploaded(inspirationImage);
      setPhoto(null);
      setDetection(null);
      setError('');
    }
  }, [inspirationImage]);
  useEffect(() => {
    let current = true;
    if (authenticated)
      api<{ detections: Detection[]; enabled: boolean; searches?: ShoppingResult[] }>(
        '/api/discovery',
      )
        .then((data) => {
          if (current) {
            setRecent(data.detections);
            setEnabled(data.enabled);
            const restored: Record<string, ShoppingResult> = {};
            const defaults: Record<string, string> = {};
            const settings: Record<string, SearchPreferences | undefined> = {};
            for (const result of data.searches ?? []) {
              const context = result.searchContext;
              if (!context) continue;
              const base = shoppingResultKey(
                context.detectionId,
                context.itemIndex,
                result.country,
              );
              const key = shoppingResultKey(
                context.detectionId,
                context.itemIndex,
                result.country,
                context.description,
                context.preferences,
              );
              if (!(key in restored)) restored[key] = result;
              if (!(base in defaults)) defaults[base] = context.description ?? '';
              if (!(base in settings)) settings[base] = context.preferences;
            }
            setShopping((previous) => ({ ...restored, ...previous }));
            setDescriptions((previous) => ({ ...defaults, ...previous }));
            setSearchSettings((previous) => ({ ...settings, ...previous }));
            setSearchHistory((previous) => [
              ...previous,
              ...(data.searches ?? []).filter(
                (entry) => !previous.some((existing) => existing.id === entry.id),
              ),
            ]);
          }
        })
        .catch(() => {
          /* Scanning remains available if history cannot load. */
        });
    return () => {
      current = false;
    };
  }, [authenticated]);

  async function scan() {
    if (!authenticated) {
      onAuth();
      return;
    }
    if (!photo && !uploaded) {
      setError('Choose a clothing or outfit photo first.');
      return;
    }
    setBusy('Reading your photo…');
    setError('');
    setSaved('');
    try {
      const imageUrl = uploaded || (await upload(photo!));
      setUploaded(imageUrl);
      const result = await api<Detection>('/api/discovery', 'POST', {
        agent: 'detect',
        retry: true,
        imageId: imageUrl.split('/').pop(),
      });
      setDetection(result);
      setRecent((previous) =>
        [result, ...previous.filter((entry) => entry.id !== result.id)].slice(0, 12),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  function reopen(entry: Detection | null) {
    setDetection(entry);
    setSaved('');
    setError('');
    const last = searchHistory.find((result) => result.searchContext?.detectionId === entry?.id);
    if (last) {
      countryChosen.current = true;
      setCountry(last.country);
    }
  }

  async function search(index: number, description?: string) {
    if (!detection) return;
    const base = shoppingResultKey(detection.id, index, country);
    const query = (description ?? descriptions[base] ?? '').trim();
    const key = shoppingResultKey(detection.id, index, country, query, preferences);
    setSearchSettings((previous) => ({ ...previous, [base]: preferences }));
    setDescriptions((previous) => ({ ...previous, [base]: query }));
    setBusy(`Finding ${detection.items[index].name.toLowerCase()}…`);
    setError('');
    setSearchErrors((previous) => ({ ...previous, [key]: '' }));
    try {
      const result = await api<ShoppingResult>('/api/discovery', 'POST', {
        agent: 'shop',
        retry: true,
        detectionId: detection.id,
        itemIndex: index,
        country,
        ...(query ? { description: query } : {}),
        ...(preferences ? { preferences } : {}),
      });
      setShopping((previous) => ({ ...previous, [key]: result }));
      setSearchHistory((previous) => [
        result,
        ...previous.filter((entry) => entry.id !== result.id),
      ]);
    } catch (e) {
      setSearchErrors((previous) => ({ ...previous, [key]: (e as Error).message }));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="discovery stack" aria-label="Clothing discovery">
      <div className="section-heading discovery-heading">
        <div>
          <h2>
            Find clothes from <span>a screenshot.</span>
          </h2>
          <p>Spotted on TikTok, Google or anywhere else? Find similar pieces to buy.</p>
        </div>
        <ScanLine size={28} />
      </div>
      <ol className="scan-steps" aria-label="Your next step">
        <li aria-current={!photo && !uploaded && !detection ? 'step' : undefined}>1 Upload</li>
        <li aria-current={(photo || uploaded) && !detection ? 'step' : undefined}>2 Identify</li>
        <li aria-current={detection ? 'step' : undefined}>3 Shop</li>
      </ol>
      <div className="screenshot-upload">
        <div className="scan-emblem" aria-hidden="true">
          <ScanLine size={32} />
        </div>
        <span>Screenshot the outfit. We’ll help you find the pieces.</span>
        <button
          className={photo || uploaded || detection ? 'compact' : 'primary screenshot-cta'}
          disabled={!!busy}
          onClick={() => fileInput.current?.click()}
        >
          {photo || uploaded || detection ? 'Change screenshot' : 'Upload screenshot'}
        </button>
        <input
          ref={fileInput}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={!!busy}
          onChange={(event) => {
            setPhoto(event.target.files?.[0] ?? null);
            setUploaded('');
            setDetection(null);
            setError('');
          }}
          aria-label="Clothing or outfit photo"
        />
      </div>
      <small>
        JPG, PNG or WebP · up to 4 MB. Scanning sends your photo to our AI provider. Only garment
        descriptions are used for shopping searches.
      </small>
      {uploaded && !photo && !detection && (
        <>
          <img className="discovery-photo" src={uploaded} alt="Selected inspiration for shopping" />
          <p>
            Your inspiration is ready. Identify the clothes, then choose a missing piece to search.
          </p>
        </>
      )}
      {(photo || uploaded) && !detection && (
        <button
          className="primary screenshot-cta"
          disabled={!!busy || enabled === false}
          onClick={scan}
        >
          <ScanLine size={18} />
          Identify clothes
        </button>
      )}
      {preview && !detection && (
        <img className="discovery-photo" src={preview} alt="Your selected screenshot" />
      )}
      {!photo && !uploaded && !detection && (
        <details className="scan-help">
          <summary>How do I get a screenshot here?</summary>
          <p>
            Pause the video or open the outfit photo. Take a screenshot, then tap Upload screenshot.
          </p>
          <p>
            Installed on a supported Android browser? Open the screenshot in Photos, tap Share and
            choose FitStalker. If it isn’t listed, use Upload screenshot.
          </p>
          <p>
            On iPhone, save the screenshot and upload it here. A TikTok or Instagram link alone does
            not include the outfit photo.
          </p>
        </details>
      )}
      {enabled === false && (
        <p role="status">
          Clothing discovery is awaiting service activation. Your saved closet and inspiration tools
          are available below.
        </p>
      )}
      {busy && (
        <p role="status" aria-live="polite">
          {busy}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <div className="stack">
          <p role="status">{saved}</p>
          {savedGarmentId && onStyleSaved && (
            <button
              className="primary"
              disabled={!!busy}
              onClick={async () => {
                setBusy('Opening your styling studio…');
                try {
                  await onRefresh();
                  onStyleSaved(savedGarmentId);
                } catch {
                  setSaved(
                    'Your piece is saved. The closet could not refresh yet. Try styling again.',
                  );
                } finally {
                  setBusy('');
                }
              }}
            >
              Style with my closet
            </button>
          )}
          {onOpenCloset && (
            <button
              disabled={!!busy}
              onClick={async () => {
                setBusy('Opening your closet…');
                try {
                  await onRefresh();
                  onOpenCloset();
                } catch {
                  setSaved(
                    'Your piece is saved. The closet could not refresh yet. Try opening it again.',
                  );
                } finally {
                  setBusy('');
                }
              }}
            >
              Open my closet
            </button>
          )}
        </div>
      )}
      {recent.length > 0 && (
        <div className="stack">
          {!detection && !photo && !uploaded && (
            <button
              className="resume-scan"
              onClick={() => {
                reopen(recent[0]);
              }}
            >
              <span>Continue your latest scan</span>
              <small>
                {recent[0].items.map((item) => item.name).join(', ') || 'Review your photo'}
              </small>
            </button>
          )}
          <label>
            Recent scans
            <select
              value={detection?.id ?? ''}
              disabled={!!busy}
              onChange={(event) => {
                reopen(recent.find((entry) => entry.id === event.target.value) ?? null);
              }}
            >
              <option value="">Choose a scan</option>
              {recent.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.items.map((item) => item.name).join(', ') || 'No clothing detected'}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {detection && (
        <label className="delete-confirmation">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => setAvailableOnly(event.target.checked)}
          />
          Only retailer-reported in-stock results
        </label>
      )}
      {detection && (
        <>
          {!!detection.items.length && (
            <div className="stack">
              <h3>Which piece caught your eye?</h3>
              <p>Explore similar shopping options, or save a piece you already own.</p>
              <nav className="piece-shortcuts" aria-label="Detected pieces">
                {detection.items.map((item, index) => (
                  <a key={index} href={`#detected-piece-${index}`}>
                    {item.name}
                  </a>
                ))}
              </nav>
            </div>
          )}
          <img
            className="discovery-photo"
            src={detection.imageUrl}
            alt="Your scanned clothing photo"
          />
          <p>{detection.note}</p>
          {!detection.items.length && (
            <p>No clothing was identified. Try a clearer photo with the whole garment visible.</p>
          )}
          {!!detection.items.length && (
            <label>
              Shopping region
              <select
                value={country}
                disabled={!!busy}
                onChange={(event) => {
                  countryChosen.current = true;
                  setCountry(event.target.value);
                }}
              >
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
              </select>
            </label>
          )}
          {preferences && (preferences.maxPrice || preferences.sizes) && (
            <p className="note">
              New searches use{' '}
              {preferences.maxPrice
                ? `a budget of ${preferences.currency} ${preferences.maxPrice} per piece`
                : 'no budget limit'}
              {preferences.sizes ? ` and sizes: ${preferences.sizes}` : ''}. Change these in Account
              settings. Availability is not guaranteed.
            </p>
          )}
          {detection.items.map((item, index) => {
            const base = shoppingResultKey(detection.id, index, country);
            const description = descriptions[base] ?? '';
            const settings = searchSettings[base];
            const key = shoppingResultKey(detection.id, index, country, description, settings);
            const result = shopping[key];
            const searchError = searchErrors[key];
            return (
              <article
                id={`detected-piece-${index}`}
                tabIndex={-1}
                className="discovery-item stack"
                key={`${detection.id}:${index}`}
              >
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  {item.uncertainty && <small>{item.uncertainty}</small>}
                </div>
                <div className="discovery-actions">
                  <button className="primary" disabled={!!busy} onClick={() => search(index)}>
                    Find where to buy
                  </button>
                  <button
                    disabled={!!busy}
                    onClick={() => {
                      setEdit(item);
                      setError('');
                    }}
                  >
                    I own this · save
                  </button>
                </div>
                <details className="search-details" key={`${base}:${description}`}>
                  <summary>Edit search details</summary>
                  <form
                    className="stack"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const value = String(
                        new FormData(event.currentTarget).get('description') ?? '',
                      ).trim();
                      if (value.length >= 3) void search(index, value);
                    }}
                  >
                    <label>
                      Describe the piece to find
                      <textarea
                        name="description"
                        required
                        minLength={3}
                        maxLength={400}
                        defaultValue={description || item.description}
                        disabled={!!busy}
                      />
                    </label>
                    <small>
                      Describe color, cut or material. Your changes guide the search; they do not
                      verify a brand or exact match. Searching may use one AI action.
                    </small>
                    <button disabled={!!busy} type="submit">
                      Search with these details
                    </button>
                    {description && (
                      <button
                        disabled={!!busy}
                        type="button"
                        onClick={() => setDescriptions((previous) => ({ ...previous, [base]: '' }))}
                      >
                        Use original details
                      </button>
                    )}
                  </form>
                </details>
                {description && <p>Searching for: {description}</p>}
                {searchError && (
                  <div className="search-recovery" role="alert">
                    <strong>Search couldn’t finish</strong>
                    <p>{searchError}</p>
                    <small>
                      Your scan is still here. No search is repeated automatically. You can search
                      another piece or region; interrupted requests may remain unavailable until
                      their status is resolved.
                    </small>
                  </div>
                )}
                {result && (
                  <div className="stack" aria-label={`Shopping results for ${item.name}`}>
                    <p>
                      Saved results · reopening does not run a new search. Prices and availability
                      may have changed; confirm with the retailer.
                    </p>
                    {result.searchContext?.preferences?.maxPrice && (
                      <small>
                        Search budget: {result.searchContext.preferences.currency}{' '}
                        {result.searchContext.preferences.maxPrice}. Unknown or different-currency
                        prices need retailer confirmation.
                      </small>
                    )}
                    <small>
                      Searched {new Date(result.searchedAt).toLocaleDateString()} · Search region is
                      a preference, not confirmed shipping coverage.
                    </small>
                    {result.listings
                      .filter(
                        (listing) =>
                          !availableOnly || listing.evidence?.availability === 'in-stock',
                      )
                      .map((listing) => (
                        <a
                          className="shopping-link"
                          href={listing.url}
                          onClick={() => {
                            void api('/api/journey', 'POST', { event: 'retailer_click' }).catch(
                              () => {},
                            );
                          }}
                          key={listing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="eyebrow">
                            {listing.match === 'possible-exact'
                              ? 'Possible exact match · unverified'
                              : 'Similar alternative'}
                          </span>
                          <strong>
                            {listing.title}
                            <ArrowUpRight size={16} />
                          </strong>
                          <span>{listing.retailer}</span>
                          <small>{listing.reason}</small>
                          <span>
                            {listing.evidence?.availability === 'in-stock'
                              ? 'Retailer reports: In stock'
                              : listing.evidence?.availability === 'out-of-stock'
                                ? 'Retailer reports: Unavailable'
                                : 'Availability unknown'}
                          </span>
                          {listing.evidence && (
                            <>
                              <small>
                                {listing.evidence.price !== undefined && listing.evidence.currency
                                  ? listing.evidence.currency +
                                    ' ' +
                                    listing.evidence.price.toFixed(2) +
                                    ' · '
                                  : ''}
                                Checked {new Date(listing.evidence.checkedAt).toLocaleString()}
                              </small>
                              <small>
                                {listing.evidence.productName &&
                                  'Retailer product: ' + listing.evidence.productName + '. '}
                                {listing.evidence.note}
                              </small>
                              <small>
                                Evidence source: {new URL(listing.evidence.sourceUrl).hostname}
                              </small>
                            </>
                          )}
                        </a>
                      ))}
                    {availableOnly &&
                      result.listings.length > 0 &&
                      !result.listings.some(
                        (listing) => listing.evidence?.availability === 'in-stock',
                      ) && (
                        <div className="stack">
                          <p>
                            No retailer-confirmed in-stock offers in these results. Turn off the
                            filter to see unchecked alternatives.
                          </p>
                          <button onClick={() => setAvailableOnly(false)}>Show all results</button>
                        </div>
                      )}
                    {!result.listings.length && (
                      <p>
                        No supported product matches found for this piece. Try another region or a
                        closer photo.
                      </p>
                    )}
                    {result.note && <small>{result.note}</small>}
                  </div>
                )}
              </article>
            );
          })}
        </>
      )}
      {edit && detection && (
        <Modal
          title="Review detected piece"
          onClose={() => {
            if (!busy) setEdit(null);
          }}
        >
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setBusy('Saving piece…');
              setError('');
              try {
                const response = await api<{ garment?: { id: string } }>('/api/garments', 'POST', {
                  name: form.get('name'),
                  brand: form.get('brand'),
                  category: form.get('category'),
                  color: form.get('color'),
                  price: null,
                  imageUrl: detection.imageUrl,
                });
                setSavedGarmentId(response.garment?.id);
                setSaved('Piece saved to your closet.');
                setEdit(null);
                try {
                  await onRefresh();
                } catch {
                  setSaved(
                    'Piece saved to your closet. Reload to refresh your closet; you don’t need to save it again.',
                  );
                }
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy('');
              }
            }}
          >
            <p>
              Check the AI’s details before saving. The original photo will be used for this piece.
            </p>
            <label>
              Piece name
              <input name="name" required maxLength={100} defaultValue={edit.name} />
            </label>
            <label>
              Brand (optional)
              <input name="brand" maxLength={80} defaultValue={edit.visibleBrand ?? ''} />
            </label>
            <label>
              Category
              <select name="category" defaultValue={edit.category}>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label>
              Color
              <input type="color" name="color" defaultValue={edit.color} />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={!!busy}>
              {busy ? 'Saving…' : 'Save piece'}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
