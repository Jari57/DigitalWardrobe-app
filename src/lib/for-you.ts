import { z } from 'zod';
export const styleChoices = [
  'streetwear',
  'minimal',
  'vintage',
  'sporty',
  'classic',
  'bold',
  'romantic',
] as const;
export const audienceChoices = ['womenswear', 'menswear', 'all-styles'] as const;
export type StyleAudience = (typeof audienceChoices)[number];
export const audienceSchema = z.enum(audienceChoices);
export function selectedAudience(preferences: {
  aesthetics: readonly string[];
}): StyleAudience | undefined {
  return audienceChoices.find((value) => preferences.aesthetics.includes(value));
}
export function setAudience(preferences: Preferences, audience: StyleAudience): Preferences {
  return {
    ...preferences,
    aesthetics: [
      ...preferences.aesthetics.filter(
        (value) => !audienceChoices.includes(value as StyleAudience),
      ),
      audience,
    ],
  };
}
export const typeChoices = [
  'tops',
  'bottoms',
  'outerwear',
  'shoes',
  'accessories',
  'dresses',
] as const;
export const preferenceSchema = z
  .object({
    categories: z.array(z.enum(typeChoices)).max(6),
    // Clothing audience is an explicit style-interest tag, not inferred identity.
    aesthetics: z
      .array(z.enum([...styleChoices, ...audienceChoices]))
      .max(8)
      .refine(
        (values) =>
          values.filter((value) => audienceChoices.includes(value as StyleAudience)).length <= 1,
        'Choose one clothing preference.',
      ),
    region: z.enum(['US', 'GB', 'CA', 'AU']),
  })
  .strict();
export type Preferences = z.infer<typeof preferenceSchema>;
export const defaultPreferences: Preferences = { categories: [], aesthetics: [], region: 'US' };
export type FeedItem = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  imageUrl?: string | null;
  imageCredit?: string | null;
  publishedAt: string;
  categories: string[];
  aesthetics: string[];
  liked: boolean;
  saved: boolean;
  reason: string;
};
const categories: Record<string, RegExp> = {
  tops: /\b(shirts?|tops?|sweaters?|knitwear|blouses?|cardigans?|tees?|t-shirts?)\b/i,
  bottoms: /\b(jeans|denim|trousers|pants|skirts?|shorts|leggings)\b/i,
  outerwear: /\b(jackets?|coats?|blazers?|trenches|trench|outerwear)\b/i,
  shoes: /\b(shoes?|boots?|flats|sneakers?|loafers?|sandals?|heels|ballet)\b/i,
  accessories:
    /\b(bags?|handbags?|belts?|scarves|jewel(?:ry|lery)|earrings?|necklaces?|sunglasses|hats?)\b/i,
  dresses: /\b(dress|dresses|gowns?)\b/i,
};
const styles: Record<string, RegExp> = {
  streetwear: /\b(streetwear|street.style|sneakers?|cargo|oversized|hoodies?)\b/i,
  minimal: /\b(minimal(?:ist)?|neutral|quiet.luxury|simple|basics?|capsule)\b/i,
  vintage: /\b(vintage|retro|thrift|second.hand|90s|70s|y2k)\b/i,
  sporty: /\b(sporty|athleisure|athletic|track|sneakers?|leggings|tennis)\b/i,
  classic: /\b(classic|tailor(?:ed|ing)?|preppy|blazers?|loafers?|trench|timeless)\b/i,
  bold: /\b(bold|colorful|colourful|purple|red|azure|leopard|metallic|statement|prints?)\b/i,
  romantic: /\b(romantic|lace|floral|bows?|ruffles?|sheer|satin)\b/i,
};
export function classifyFashion(text: string) {
  return {
    categories: Object.keys(categories).filter((key) => categories[key].test(text)),
    aesthetics: Object.keys(styles).filter((key) => styles[key].test(text)),
  };
}
type Candidate = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  imageUrl?: string | null;
  imageCredit?: string | null;
  publishedAt: Date;
  categories: string[];
  aesthetics: string[];
};
type Feedback = {
  itemId: string;
  liked: boolean;
  saved: boolean;
  hidden: boolean;
  item: { categories: string[]; aesthetics: string[] };
};
export function storyAudience(item: { title: string; publisher: string }): StyleAudience {
  const women = /\b(womenswear|women(?:'s|’s)?|female)\b/i.test(item.title);
  const men = /\b(menswear|men(?:'s|’s)?|male)\b/i.test(item.title);
  if (women && men) return 'all-styles';
  if (women) return 'womenswear';
  if (men) return 'menswear';
  // Editorial focus is only a broad fallback; no photo, color or body inference.
  if (['GQ', 'Esquire'].includes(item.publisher)) return 'menswear';
  if (['Who What Wear', 'ELLE', "Harper's Bazaar", 'Vogue'].includes(item.publisher))
    return 'womenswear';
  return 'all-styles';
}
export function rankFeed(
  items: Candidate[],
  preferences: Preferences,
  feedback: Feedback[],
  mode: string,
  now = new Date(),
): FeedItem[] {
  const byId = new Map(feedback.map((entry) => [entry.itemId, entry]));
  const audience = selectedAudience(preferences) ?? 'all-styles';
  const weights = new Map<string, number>();
  for (const entry of feedback)
    for (const tag of [...entry.item.categories, ...entry.item.aesthetics])
      weights.set(
        tag,
        (weights.get(tag) ?? 0) +
          (entry.hidden ? -2 : (entry.liked ? 1 : 0) + (entry.saved ? 2 : 0)),
      );
  return items
    .filter((item) => !byId.get(item.id)?.hidden && (mode !== 'saved' || byId.get(item.id)?.saved))
    .filter(
      (item) =>
        mode === 'saved' ||
        audience === 'all-styles' ||
        storyAudience(item) === 'all-styles' ||
        storyAudience(item) === audience,
    )
    .map((item) => {
      const tags = [...item.categories, ...item.aesthetics];
      const matches = [...preferences.categories, ...preferences.aesthetics].filter((tag) =>
        tags.includes(tag),
      );
      const learned = tags.reduce(
        (sum, tag) => sum + Math.max(-4, Math.min(4, weights.get(tag) ?? 0)),
        0,
      );
      const freshness = Math.max(0, 14 - (now.getTime() - item.publishedAt.getTime()) / 86400000);
      const score =
        mode === 'latest' || mode === 'saved'
          ? item.publishedAt.getTime()
          : matches.length * 8 + learned + freshness;
      const reason = matches.length
        ? `Matches your ${matches.slice(0, 2).join(' and ')} interests`
        : learned > 0
          ? 'Related to pieces you liked or saved'
          : 'A fresh style idea to explore';
      return {
        score,
        item: {
          ...item,
          publishedAt: item.publishedAt.toISOString(),
          liked: !!byId.get(item.id)?.liked,
          saved: !!byId.get(item.id)?.saved,
          reason,
        },
      };
    })
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .map(({ item }) => item);
}
