import { z } from 'zod';
import { shoppingPreferencesSchema } from './experience';
export const searchPreferencesSchema = shoppingPreferencesSchema.omit({ region: true });
export type SearchPreferences = z.infer<typeof searchPreferencesSchema>;

export const shoppingRequestSchema = z
  .object({
    agent: z.literal('shop'),
    detectionId: z.string().min(1).max(80),
    itemIndex: z.number().int().min(0).max(5),
    country: z.enum(['US', 'GB', 'CA', 'AU']),
    description: z.string().trim().min(3).max(400).optional(),
    preferences: searchPreferencesSchema.optional(),
  })
  .strict();

export function shoppingResultKey(
  detectionId: string,
  itemIndex: number,
  country: string,
  description = '',
  preferences?: SearchPreferences,
) {
  return JSON.stringify([
    detectionId,
    itemIndex,
    country,
    description.trim(),
    preferences ? [preferences.currency, preferences.maxPrice, preferences.sizes] : null,
  ]);
}

export function shoppingItem(item: DetectedItem, description?: string): DetectedItem {
  if (!description) return item;
  return {
    ...item,
    name: 'User-described garment',
    description,
    visibleBrand: null,
    readableText: [],
    visibleModelCode: null,
    uncertainty: 'User-supplied search description; brand and product identity are unverified.',
  };
}

export const detectedItemSchema = z
  .object({
    name: z.string().min(1).max(100),
    category: z.enum(['tops', 'bottoms', 'outerwear', 'shoes', 'accessories', 'dresses']),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .describe(
        'Dominant garment color as a six-digit hexadecimal RGB value, for example #729AB0. Never a color name.',
      ),
    description: z.string().min(1).max(400),
    visibleBrand: z.string().max(80).nullable(),
    uncertainty: z.string().max(300),
    readableText: z.array(z.string().max(100)).max(4).optional(),
    visibleModelCode: z.string().max(80).nullable().optional(),
  })
  .strict();
export const detectionSchema = z
  .object({
    items: z.array(detectedItemSchema).max(6),
    note: z.string().max(400),
  })
  .strict();
export type DetectedItem = z.infer<typeof detectedItemSchema>;
export function parseShoppingSources(output: unknown) {
  const failure = z
    .object({ error: z.string(), statusCode: z.number().optional() })
    .safeParse(output);
  if (failure.success) {
    const error = new Error('Shopping search provider could not complete the search.');
    Object.assign(error, { statusCode: failure.data.statusCode ?? 503 });
    throw error;
  }
  // A malformed response is a service failure, not evidence that no products exist.
  return z
    .object({
      results: z
        .array(z.object({ title: z.string(), url: z.string(), snippet: z.string() }))
        .max(20),
    })
    .parse(output).results;
}
export type Detection = z.infer<typeof detectionSchema> & { id: string; imageUrl: string };
export function captureSummary(count: number) {
  return count === 0
    ? 'No clothing was identified. Try a clearer photo with the whole garment visible.'
    : `${count} visible ${count === 1 ? 'piece' : 'pieces'} identified. Scans cover up to six pieces; hidden or unclear items may be missed. Review the details before saving.`;
}
export type ProductEvidence = {
  availability: 'in-stock' | 'out-of-stock' | 'unknown';
  checkedAt: string;
  sourceUrl: string;
  productName?: string;
  brand?: string;
  modelCode?: string;
  colorName?: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  note: string;
};
export type ShoppingResult = {
  id: string;
  searchContext?: {
    detectionId: string;
    itemIndex: number;
    description?: string;
    preferences?: SearchPreferences;
  };
  searchedAt: string;
  country: string;
  listings: {
    title: string;
    url: string;
    retailer: string;
    reason: string;
    match: 'similar' | 'possible-exact';
    evidence?: ProductEvidence;
    visualReview?: {
      status: 'consistent' | 'similar' | 'different' | 'unclear' | 'not-reviewed';
      note: string;
    };
    identityEvidence?: 'matching-code-and-visuals' | 'unverified';
  }[];
  note: string;
};

// Conservative URL signals, not proof of product identity or availability.
export function shoppingPageKind(value: string): 'excluded' | 'product-path' | 'unknown' {
  const safe = safeShoppingUrl(value);
  if (!safe) return 'excluded';
  const url = new URL(safe);
  const host = url.hostname.toLowerCase();
  if (
    [
      'tiktok.com',
      'instagram.com',
      'facebook.com',
      'pinterest.com',
      'pinterest.co.uk',
      'youtube.com',
      'youtu.be',
      'reddit.com',
      'x.com',
      'twitter.com',
      'editorialist.com',
    ].some((domain) => host === domain || host.endsWith('.' + domain))
  )
    return 'excluded';
  let path: string;
  try {
    path = decodeURIComponent(url.pathname).toLowerCase();
  } catch {
    return 'excluded';
  }
  // Adidas uses a model-code HTML path, not a /product/ segment. This is a URL
  // shape signal only: it does not verify identity, price, stock or authenticity.
  if (
    /^(?:www\.)?adidas\.(?:com|co\.uk|ca|com\.au)$/.test(host) &&
    /^\/(?:[a-z]{2}\/)?[a-z0-9-]+\/[a-z0-9]{6}\.html$/.test(path)
  )
    return 'product-path';
  // A collection may contain a direct product URL, so check that first.
  if (/\/(?:products?|dp|pd|p)\/[^/]+/.test(path) || /\/[^/]+-p\d+\.html$/.test(path))
    return 'product-path';
  if (
    /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/?)?$/.test(path) ||
    /\/(?:collections?|categor(?:y|ies)|search|blogs?|articles?|editorial|stories)(?:\/|$)/.test(
      path,
    )
  )
    return 'excluded';
  return 'unknown';
}

export function prioritizeShoppingListings(
  listings: ShoppingResult['listings'],
): ShoppingResult['listings'] {
  // Preserve model relevance order within each evidence tier. Never promote an
  // unselected search result just because it has structured product metadata.
  const eligible = listings.filter(
    (listing) =>
      shoppingPageKind(listing.url) !== 'excluded' &&
      (!listing.evidence || shoppingPageKind(listing.evidence.sourceUrl) !== 'excluded'),
  );
  const priority = (listing: ShoppingResult['listings'][number]) =>
    listing.evidence?.productName ? 2 : shoppingPageKind(listing.url) === 'product-path' ? 1 : 0;
  return [...eligible].sort((a, b) => priority(b) - priority(a));
}

// Only public HTTPS links from search output are eligible. Never fetch model URLs.
export function safeShoppingUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !host.includes('.') ||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) ||
      /^[\d.]+$/.test(host) ||
      host.includes(':') ||
      host.startsWith('[')
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export const rankingSchema = z
  .object({
    listings: z
      .array(
        z
          .object({
            sourceIndex: z.number().int().min(0).max(7),
            reason: z.string().min(1).max(280),
            match: z.enum(['similar', 'possible-exact']),
          })
          .strict(),
      )
      .max(5),
    note: z.string().max(400),
  })
  .strict();

// Models do not consistently honor JSON Schema string-length constraints.
// Normalize presentation text; keep source indices and match enums strictly typed.
export const rankingProviderSchema = rankingSchema.extend({
  note: z.string(),
  listings: z.array(
    z
      .object({
        sourceIndex: z.number().int().min(0).max(7),
        reason: z.string(),
        match: z.enum(['similar', 'possible-exact']),
      })
      .strict(),
  ),
});
export function normalizeRanking(value: z.infer<typeof rankingProviderSchema>) {
  return rankingSchema.parse({
    note: value.note.slice(0, 400),
    listings: value.listings
      .slice(0, 5)
      .map((item) => ({ ...item, reason: item.reason.slice(0, 280) })),
  });
}

export function groundedListings(
  ranking: z.infer<typeof rankingSchema>,
  sources: { title: string; url: string }[],
  visibleBrand: string | null,
) {
  const words = (text: string) =>
    ' ' +
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim() +
    ' ';
  const seen = new Set<string>();
  return ranking.listings.flatMap((item) => {
    const source = sources[item.sourceIndex];
    const url = source && safeShoppingUrl(source.url);
    if (!source || !url || shoppingPageKind(url) === 'excluded' || seen.has(url)) return [];
    seen.add(url);
    return [
      {
        title: source.title.slice(0, 200),
        url,
        retailer: new URL(url).hostname.replace(/^www\./, ''),
        reason: item.reason,
        match:
          item.match === 'possible-exact' &&
          visibleBrand &&
          words(source.title).includes(words(visibleBrand))
            ? ('possible-exact' as const)
            : ('similar' as const),
      },
    ];
  });
}
