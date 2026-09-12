import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { safeShoppingUrl, type ProductEvidence } from '@/lib/discovery';

// IPv4 only: pin the validated address while preserving TLS hostname verification.
export function publicAddress(ip: string) {
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

type Page = { url: string; html: string };
export async function fetchProductPage(value: string): Promise<Page> {
  const signal = AbortSignal.timeout(8000);
  let current = value;
  for (let hop = 0; hop <= 2; hop++) {
    const safe = safeShoppingUrl(current);
    if (!safe) throw new Error('Blocked destination');
    const url = new URL(safe);
    signal.throwIfAborted();
    const addresses = await new Promise<LookupAddress[]>((resolve, reject) => {
      const abort = () => reject(new Error('Lookup timed out'));
      signal.addEventListener('abort', abort, { once: true });
      lookup(url.hostname, { family: 4, all: true }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
    signal.throwIfAborted();
    if (!Array.isArray(addresses) || !addresses.length || addresses.some(entry => !publicAddress(entry.address))) throw new Error('Blocked address');
    const address = addresses[0].address;
    const response = await new Promise<{ redirect?: string; html?: string }>((resolve, reject) => {
      const req = request(url, { signal, agent: false, family: 4, headers: { Accept: 'text/html', 'Accept-Encoding': 'identity', 'User-Agent': 'DigitalWardrobe/1.0 (product metadata check)' },
        lookup: (_host, _options, callback) => callback(null, address, 4),
      }, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
          res.destroy();
          try { resolve({ redirect: new URL(res.headers.location, url).href }); } catch (error) { reject(error); }
          return;
        }
        if (res.statusCode !== 200 || !res.headers['content-type']?.includes('text/html') || (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')) {
          res.destroy(); reject(new Error('Product page unavailable')); return;
        }
        const chunks: Buffer[] = []; let bytes = 0;
        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 1_000_000) { res.destroy(); reject(new Error('Product page too large')); }
          else chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }));
      });
      req.on('error', reject); req.end();
    });
    if (response.redirect) { current = response.redirect; continue; }
    return { url: safe, html: response.html ?? '' };
  }
  throw new Error('Too many redirects');
}

function typeIs(value: unknown, type: string): boolean {
  return (Array.isArray(value) ? value : [value]).some(v => v === type || v === `https://schema.org/${type}` || v === `http://schema.org/${type}`);
}
function samePage(value: unknown, page: string) {
  if (typeof value !== 'string') return false;
  try { const a = new URL(value, page), b = new URL(page); return a.origin === b.origin && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '') && a.search === b.search; } catch { return false; }
}
export function parseProductEvidence(html: string, sourceUrl: string, checkedAt = new Date().toISOString()): ProductEvidence {
  const unknown: ProductEvidence = { availability: 'unknown', checkedAt, sourceUrl, note: 'Retailer stock and price could not be confirmed.' };
  const products: Record<string, unknown>[] = [];
  let visited = 0;
  function visit(node: unknown, depth = 0) {
    if (++visited > 300 || depth > 12 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(v => visit(v, depth + 1)); return; }
    const item = node as Record<string, unknown>;
    if (typeIs(item['@type'], 'Product')) products.push(item);
    // Only top-level product documents/graphs, never related-product carousels.
    if (item['@graph']) visit(item['@graph'], depth + 1);
    if (item.mainEntity) visit(item.mainEntity, depth + 1);
  }
  const scripts = html.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi);
  let count = 0;
  for (const script of scripts) {
    if (++count > 24) break;
    try { visit(JSON.parse(script[1])); } catch { /* Invalid metadata is not evidence. */ }
  }
  const matching = products.filter(p => samePage(p.url ?? p['@id'], sourceUrl));
  const product = matching.length === 1 ? matching[0] : products.length === 1 && !products[0].url && !products[0]['@id'] ? products[0] : null;
  if (!product || typeof product.name !== 'string') return unknown;
  const offers = Array.isArray(product.offers) ? product.offers : product.offers ? [product.offers] : [];
  if (offers.length !== 1 || !offers[0] || !typeIs(offers[0]['@type'], 'Offer')) return { ...unknown, productName: product.name.slice(0, 200), note: 'Multiple variants or no single offer. Check the retailer for your size and color.' };
  const offer = offers[0];
  if (offer.url && !samePage(offer.url, sourceUrl)) return unknown;
  if (typeof offer.priceValidUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(offer.priceValidUntil) && offer.priceValidUntil < checkedAt.slice(0, 10)) return { ...unknown, note: 'The retailer’s offer metadata has expired.' };
  const availability = ['https://schema.org/InStock', 'http://schema.org/InStock'].includes(offer.availability) ? 'in-stock' :
    ['https://schema.org/OutOfStock', 'http://schema.org/OutOfStock', 'https://schema.org/SoldOut', 'http://schema.org/SoldOut', 'https://schema.org/Discontinued', 'http://schema.org/Discontinued'].includes(offer.availability) ? 'out-of-stock' : 'unknown';
  const price = typeof offer.price === 'number' || (typeof offer.price === 'string' && /^\d+(\.\d{1,4})?$/.test(offer.price)) ? Number(offer.price) : NaN;
  const currency = typeof offer.priceCurrency === 'string' && /^[A-Z]{3}$/.test(offer.priceCurrency) ? offer.priceCurrency : undefined;
  return { availability, checkedAt, sourceUrl, productName: product.name.slice(0, 200), ...(Number.isFinite(price) && price >= 0 && currency ? { price, currency } : {}), note: 'Retailer-reported page offer. Size, color, shipping and checkout price still need checking.' };
}

export async function productEvidence(url: string): Promise<ProductEvidence> {
  try { const page = await fetchProductPage(url); return parseProductEvidence(page.html, page.url); }
  catch { return { availability: 'unknown', checkedAt: new Date().toISOString(), sourceUrl: url, note: 'Retailer page could not be checked. Open the source to confirm details.' }; }
}
