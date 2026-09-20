import {
  safeShoppingUrl,
  shoppingPageKind,
  type SearchPreferences,
  type ShoppingResult,
} from './discovery';

export type ShoppingCountry = 'US' | 'GB' | 'CA' | 'AU';
export const shoppingRegions = {
  US: { name: 'United States', currency: 'USD' },
  GB: { name: 'United Kingdom', currency: 'GBP' },
  CA: { name: 'Canada', currency: 'CAD' },
  AU: { name: 'Australia', currency: 'AUD' },
} as const;

// Storefront signals only. A matching locale is never a shipping guarantee.
export function storefrontRegion(
  value: string,
  country: string,
): 'matching' | 'conflicting' | 'unknown' {
  const safe = safeShoppingUrl(value);
  if (!safe) return 'conflicting';
  const url = new URL(safe);
  let segments: string[];
  try {
    segments = decodeURIComponent(url.pathname).toLowerCase().split('/').filter(Boolean);
  } catch {
    return 'conflicting';
  }
  const aliases: Record<string, string> = {
    us: 'US',
    usa: 'US',
    uk: 'GB',
    gb: 'GB',
    ca: 'CA',
    au: 'AU',
    eu: 'EU',
    il: 'IL',
    de: 'DE',
    fr: 'FR',
    it: 'IT',
    es: 'ES',
    jp: 'JP',
    cn: 'CN',
    in: 'IN',
    nz: 'NZ',
  };
  const signals: string[] = [];
  const hostCountry = url.hostname.match(/\.(uk|ca|au|de|fr|it|es|jp|cn|in|nz|us)$/)?.[1];
  if (hostCountry) signals.push(aliases[hostCountry]);
  const languages = new Set(['en', 'fr', 'de', 'es', 'it', 'ja', 'zh', 'pt', 'ko', 'nl']);
  for (const part of [
    url.hostname.split('.')[0],
    segments[0] ?? '',
    ...(languages.has(segments[0]) ? [segments[1] ?? ''] : []),
  ]) {
    const locale = part.match(/^(?:[a-z]{2}-([a-z]{2})|([a-z]{2})-[a-z]{2})$/);
    // en-us and il-en are both common; never interpret a plain language code as a country.
    const region =
      (!languages.has(part) ? aliases[part] : undefined) ??
      (locale
        ? aliases[languages.has(part.split('-')[0]) ? locale[1] : part.split('-')[0]]
        : undefined);
    if (region) signals.push(region);
  }
  if (signals.some((signal) => signal !== country)) return 'conflicting';
  return signals.length ? 'matching' : 'unknown';
}

export function canonicalProductUrl(value: string) {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()])
    if (/^(utm_.+|gclid|fbclid|msclkid|ref|affiliate|affid)$/i.test(key))
      url.searchParams.delete(key);
  url.searchParams.sort();
  url.hostname = url.hostname.replace(/^www\./, '');
  return url.href.replace(/\/$/, '');
}

export function qualityShoppingListings(
  listings: ShoppingResult['listings'],
  country: string,
  preferences?: SearchPreferences,
  category?: string,
) {
  const seen = new Set<string>();
  const kept = listings.filter((listing) => {
    if (!safeShoppingUrl(listing.url) || storefrontRegion(listing.url, country) === 'conflicting')
      return false;
    const evidence = listing.evidence;
    const kind = productCategory(evidence?.productName ?? listing.title);
    if (category && kind && kind !== category) return false;
    if (
      evidence &&
      (!safeShoppingUrl(evidence.sourceUrl) ||
        storefrontRegion(evidence.sourceUrl, country) === 'conflicting' ||
        shoppingPageKind(evidence.sourceUrl) === 'excluded')
    )
      return false;
    if (shoppingPageKind(listing.url) === 'excluded') return false;
    // Unknown URL structures need actual product metadata; arbitrary snippets are insufficient.
    if (shoppingPageKind(listing.url) === 'unknown' && !evidence?.productName) return false;
    if (
      preferences?.maxPrice &&
      evidence?.currency === preferences.currency &&
      evidence.price !== undefined &&
      evidence.price > preferences.maxPrice
    )
      return false;
    const key = canonicalProductUrl(evidence?.productName ? evidence.sourceUrl : listing.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const score = (listing: ShoppingResult['listings'][number]) =>
    (listing.evidence?.availability === 'out-of-stock' ? -10 : 0) +
    (listing.evidence?.productName ? 3 : 0) +
    (storefrontRegion(listing.url, country) === 'matching' ? 1 : 0);
  return [...kept].sort((a, b) => score(b) - score(a));
}

// Only clear product-type words can veto an offer; ambiguous names remain unclassified.
export function productCategory(title: string): string | undefined {
  const text = title.toLowerCase().replace(/\bdress shirts?\b/g, 'shirt');
  const kinds = [
    [/\b(dress|dresses|gown)\b/, 'dresses'],
    [/\b(jeans|trousers|pants|skirt|shorts)\b/, 'bottoms'],
    [/\b(shoes|sneakers|boots|sandals|loafers)\b/, 'shoes'],
    [/\b(jacket|coat|parka|blazer)\b/, 'outerwear'],
    [/\b(shirt|blouse|sweater|hoodie|t-shirt)\b/, 'tops'],
  ] as const;
  if (/\b(shirt dress|shirt-dress)\b/.test(text)) return 'dresses';
  const found = kinds.filter(([pattern]) => pattern.test(text));
  return found.length === 1 ? found[0][1] : undefined;
}

export function conciseText(value: string, limit: number) {
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const boundary = cut.lastIndexOf(' ');
  return cut.slice(0, boundary > limit / 2 ? boundary : cut.length).trimEnd() + '…';
}

export function reviewShoppingResult(result: ShoppingResult): ShoppingResult {
  const listings = qualityShoppingListings(
    result.listings,
    result.country,
    result.searchContext?.preferences,
  );
  return {
    ...result,
    listings,
    note:
      listings.length < result.listings.length
        ? `${listings.length ? 'Some saved offers were hidden' : 'Saved offers were hidden'} by the current storefront, product or budget checks. Edit details or search again for fresh alternatives.`
        : result.note,
  };
}
