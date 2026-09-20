import { z } from 'zod';
export const shoppingPreferencesSchema = z
  .object({
    region: z.enum(['US', 'GB', 'CA', 'AU']),
    currency: z.enum(['USD', 'GBP', 'CAD', 'AUD']),
    maxPrice: z.number().int().min(1).max(100000).nullable(),
    sizes: z.string().trim().max(80),
  })
  .strict();
export type ShoppingPreferences = z.infer<typeof shoppingPreferencesSchema>;
export const defaultShoppingPreferences: ShoppingPreferences = {
  region: 'US',
  currency: 'USD',
  maxPrice: null,
  sizes: '',
};
export const draftSchema = z
  .array(
    z
      .object({
        garmentId: z.string().min(1).max(80),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        scale: z.number().min(0.25).max(3),
        zIndex: z.number().int().min(0).max(1000),
      })
      .strict(),
  )
  .max(12)
  .refine(
    (pieces) => new Set(pieces.map((p) => p.garmentId)).size === pieces.length,
    'A piece can only appear once.',
  );
