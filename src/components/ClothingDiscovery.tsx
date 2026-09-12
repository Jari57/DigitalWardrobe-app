"use client";
import { useEffect, useState } from 'react';
import { ScanLine, ArrowUpRight } from 'lucide-react';
import type { Detection, DetectedItem, ShoppingResult } from '@/lib/discovery';
import { api, categories, Modal, upload } from './ui';

export default function ClothingDiscovery({ authenticated, onAuth, onRefresh }: {
  authenticated: boolean; onAuth: () => void; onRefresh: () => Promise<void>;
}) {
  const [recent, setRecent] = useState<Detection[]>([]);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [shopping, setShopping] = useState<Record<string, ShoppingResult>>({});
  const [country, setCountry] = useState('US');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState('');
  const [edit, setEdit] = useState<DetectedItem | null>(null);
  const [saved, setSaved] = useState('');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let current = true;
    if (authenticated) api<{ detections: Detection[]; enabled: boolean }>('/api/discovery').then(data => {
      if (current) { setRecent(data.detections); setEnabled(data.enabled); }
    }).catch(() => { /* Scanning remains available if history cannot load. */ });
    return () => { current = false; };
  }, [authenticated]);

  async function scan() {
    if (!authenticated) { onAuth(); return; }
    if (!photo) { setError('Choose a clothing or outfit photo first.'); return; }
    setBusy('Reading your photo…'); setError(''); setSaved('');
    try {
      const imageUrl = uploaded || await upload(photo);
      setUploaded(imageUrl);
      const result = await api<Detection>('/api/discovery', 'POST', { agent: 'detect', imageId: imageUrl.split('/').pop() });
      setDetection(result);
      setRecent(previous => [result, ...previous.filter(entry => entry.id !== result.id)].slice(0, 12));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }

  async function search(index: number) {
    if (!detection) return;
    setBusy(`Finding ${detection.items[index].name.toLowerCase()}…`); setError('');
    try {
      const result = await api<ShoppingResult>('/api/discovery', 'POST', { agent: 'shop', detectionId: detection.id, itemIndex: index, country });
      setShopping(previous => ({ ...previous, [`${detection.id}:${index}:${country}`]: result }));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }

  return <section className="discovery stack" aria-label="Clothing discovery">
    <div className="section-heading"><div><span className="eyebrow">PHOTO TO FIND</span><h2>See it. Find your version.</h2><p>Identify the pieces. Discover where to shop.</p></div><ScanLine size={28}/></div>
    <label>Clothing or outfit photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={event => { setPhoto(event.target.files?.[0] ?? null); setUploaded(''); setError(''); }}/></label>
    <small>JPG, PNG or WebP · up to 4 MB. Scanning sends your photo to our AI provider. Only garment descriptions are used for shopping searches.</small>
    <button className="primary" disabled={!!busy || enabled === false} onClick={scan}><ScanLine size={18}/>Identify clothes</button>
    {enabled === false && <p role="status">Clothing discovery is awaiting service activation. Your saved closet and inspiration tools are available below.</p>}
    {busy && <p role="status" aria-live="polite">{busy}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {saved && <p role="status">{saved}</p>}
    {recent.length > 0 && <label>Recent scans<select value={detection?.id ?? ''} disabled={!!busy} onChange={event => { setDetection(recent.find(entry => entry.id === event.target.value) ?? null); setSaved(''); }}><option value="">Choose a scan</option>{recent.map(entry => <option key={entry.id} value={entry.id}>{entry.items.map(item => item.name).join(', ') || 'No clothing detected'}</option>)}</select></label>}
    {detection && <>
      <img className="discovery-photo" src={detection.imageUrl} alt="Your scanned clothing photo"/>
      <p>{detection.note}</p>
      {!detection.items.length && <p>No clothing was identified. Try a clearer photo with the whole garment visible.</p>}
      {!!detection.items.length && <label>Shopping region<select value={country} disabled={!!busy} onChange={event => setCountry(event.target.value)}><option value="US">United States</option><option value="GB">United Kingdom</option><option value="CA">Canada</option><option value="AU">Australia</option></select></label>}
      {detection.items.map((item, index) => {
        const result = shopping[`${detection.id}:${index}:${country}`];
        return <article className="discovery-item stack" key={`${detection.id}:${index}`}>
          <div><h3>{item.name}</h3><p>{item.description}</p>{item.uncertainty && <small>{item.uncertainty}</small>}</div>
          <div className="discovery-actions"><button className="primary" disabled={!!busy} onClick={() => search(index)}>Find where to buy</button><button disabled={!!busy} onClick={() => { setEdit(item); setError(''); }}>I own this · save</button></div>
          {result && <div className="stack" aria-label={`Shopping results for ${item.name}`}>
            <small>Searched {new Date(result.searchedAt).toLocaleDateString()} · Check the retailer for price, sizes and availability.</small>
            {result.listings.map(listing => <a className="shopping-link" href={listing.url} key={listing.url} target="_blank" rel="noopener noreferrer"><span className="eyebrow">{listing.match === 'possible-exact' ? 'Possible exact match · unverified' : 'Similar alternative'}</span><strong>{listing.title}<ArrowUpRight size={16}/></strong><span>{listing.retailer}</span><small>{listing.reason}</small></a>)}
            {!result.listings.length && <p>No supported product matches found for this piece. Try another region or a closer photo.</p>}
            {result.note && <small>{result.note}</small>}
          </div>}
        </article>;
      })}
    </>}
    {edit && detection && <Modal title="Review detected piece" onClose={() => { if (!busy) setEdit(null); }}>
      <form className="stack" onSubmit={async event => {
        event.preventDefault(); const form = new FormData(event.currentTarget); setBusy('Saving piece…'); setError('');
        try {
          await api('/api/garments', 'POST', { name: form.get('name'), brand: form.get('brand'), category: form.get('category'), color: form.get('color'), price: null, imageUrl: detection.imageUrl });
          await onRefresh(); setSaved('Piece saved to your closet.'); setEdit(null);
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(''); }
      }}>
        <p>Check the AI’s details before saving. The original photo will be used for this piece.</p>
        <label>Piece name<input name="name" required maxLength={100} defaultValue={edit.name}/></label>
        <label>Brand (optional)<input name="brand" maxLength={80} defaultValue={edit.visibleBrand ?? ''}/></label>
        <label>Category<select name="category" defaultValue={edit.category}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
        <label>Color<input type="color" name="color" defaultValue={edit.color}/></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={!!busy}>{busy ? 'Saving…' : 'Save piece'}</button>
      </form>
    </Modal>}
  </section>;
}
