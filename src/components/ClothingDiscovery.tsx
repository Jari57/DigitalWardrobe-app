'use client';
import { useEffect, useRef, useState } from 'react';
import { ScanLine, ArrowUpRight } from 'lucide-react';
import type { Detection, DetectedItem, ShoppingResult } from '@/lib/discovery';
import { api, categories, Modal, upload } from './ui';

export default function ClothingDiscovery({
  authenticated,
  onAuth,
  onRefresh,
  inspirationImage,
  initialPhoto,
  onPhotoReceived,
}: {
  authenticated: boolean;
  onAuth: () => void;
  onRefresh: () => Promise<void>;
  inspirationImage?: string;
  initialPhoto?: File | null;
  onPhotoReceived?: () => void;
}) {
  const [recent, setRecent] = useState<Detection[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [shopping, setShopping] = useState<Record<string, ShoppingResult>>({});
  const [country, setCountry] = useState('US');
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
  const [enabled, setEnabled] = useState<boolean | null>(null);
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
      api<{ detections: Detection[]; enabled: boolean }>('/api/discovery')
        .then((data) => {
          if (current) {
            setRecent(data.detections);
            setEnabled(data.enabled);
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

  async function search(index: number) {
    if (!detection) return;
    setBusy(`Finding ${detection.items[index].name.toLowerCase()}…`);
    setError('');
    try {
      const result = await api<ShoppingResult>('/api/discovery', 'POST', {
        agent: 'shop',
        detectionId: detection.id,
        itemIndex: index,
        country,
      });
      setShopping((previous) => ({ ...previous, [`${detection.id}:${index}:${country}`]: result }));
    } catch (e) {
      setError((e as Error).message);
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
      {uploaded && !photo && (
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
      {saved && <p role="status">{saved}</p>}
      {recent.length > 0 && (
        <label>
          Recent scans
          <select
            value={detection?.id ?? ''}
            disabled={!!busy}
            onChange={(event) => {
              setDetection(recent.find((entry) => entry.id === event.target.value) ?? null);
              setSaved('');
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
          {!!detection.items.length && <p>Choose a piece to find where it’s sold.</p>}
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
                onChange={(event) => setCountry(event.target.value)}
              >
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
              </select>
            </label>
          )}
          {detection.items.map((item, index) => {
            const result = shopping[`${detection.id}:${index}:${country}`];
            return (
              <article className="discovery-item stack" key={`${detection.id}:${index}`}>
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
                {result && (
                  <div className="stack" aria-label={`Shopping results for ${item.name}`}>
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
                        <p>
                          No retailer-confirmed in-stock offers in these results. Turn off the
                          filter to see unchecked alternatives.
                        </p>
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
                await api('/api/garments', 'POST', {
                  name: form.get('name'),
                  brand: form.get('brand'),
                  category: form.get('category'),
                  color: form.get('color'),
                  price: null,
                  imageUrl: detection.imageUrl,
                });
                await onRefresh();
                setSaved('Piece saved to your closet.');
                setEdit(null);
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
