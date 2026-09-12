import { z } from 'zod';

export const detectedItemSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['tops', 'bottoms', 'outerwear', 'shoes', 'accessories', 'dresses']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).describe('Dominant garment color as a six-digit hexadecimal RGB value, for example #729AB0. Never a color name.'),
  description: z.string().min(1).max(400),
  visibleBrand: z.string().max(80).nullable(),
  uncertainty: z.string().max(300),
}).strict();
export const detectionSchema = z.object({
  items: z.array(detectedItemSchema).max(6),
  note: z.string().max(400),
}).strict();
export type DetectedItem = z.infer<typeof detectedItemSchema>;
export type Detection = z.infer<typeof detectionSchema> & { id: string; imageUrl: string };
export type ShoppingResult = {
  id: string; searchedAt: string; country: string;
  listings: { title: string; url: string; retailer: string; reason: string; match: 'similar' | 'possible-exact' }[];
  note: string;
};

// Only public HTTPS links from search output are eligible. Never fetch model URLs.
export function safeShoppingUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !host.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) ||
      /^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return null;
    return url.href;
  } catch { return null; }
}

export const rankingSchema = z.object({
  listings: z.array(z.object({
    sourceIndex: z.number().int().min(0).max(7),
    reason: z.string().min(1).max(280),
    match: z.enum(['similar', 'possible-exact']),
  }).strict()).max(5),
  note: z.string().max(400),
}).strict();

// Models do not consistently honor JSON Schema string-length constraints.
// Normalize presentation text; keep source indices and match enums strictly typed.
export const rankingProviderSchema = rankingSchema.extend({
  note: z.string(),
  listings: z.array(z.object({ sourceIndex: z.number().int().min(0).max(7), reason: z.string(), match: z.enum(['similar', 'possible-exact']) }).strict()),
});
export function normalizeRanking(value: z.infer<typeof rankingProviderSchema>) {
  return rankingSchema.parse({ note: value.note.slice(0, 400), listings: value.listings.slice(0, 5).map(item => ({ ...item, reason: item.reason.slice(0, 280) })) });
}

export function groundedListings(ranking: z.infer<typeof rankingSchema>, sources: { title: string; url: string }[], visibleBrand: string | null) {
  const seen = new Set<string>();
  return ranking.listings.flatMap(item => {
    const source = sources[item.sourceIndex];
    const url = source && safeShoppingUrl(source.url);
    if (!source || !url || seen.has(url)) return [];
    seen.add(url);
    return [{ title: source.title.slice(0, 200), url, retailer: new URL(url).hostname.replace(/^www\./, ''),
      reason: item.reason, match: item.match === 'possible-exact' && visibleBrand ? 'possible-exact' as const : 'similar' as const }];
  });
}

