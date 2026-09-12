import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,32}$/, 'Use 3–32 letters, numbers, or underscores.');
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128, 'Use no more than 128 characters.');
export const imageUrlSchema = z
  .string()
  .regex(/^\/api\/images\/[a-zA-Z0-9_-]{1,80}$/, 'Upload a photo first.');
export const garmentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    brand: z.string().trim().max(100).default(''),
    category: z.enum(['tops', 'bottoms', 'outerwear', 'shoes', 'accessories', 'dresses']),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Choose a valid color.'),
    price: z.number().finite().min(0).max(99999999.99).nullable().default(null),
    imageUrl: imageUrlSchema,
  })
  .strict();
export const pieceSchema = z
  .object({
    garmentId: z.string().min(1).max(80),
    x: z.number().finite().min(-10000).max(10000),
    y: z.number().finite().min(-10000).max(10000),
    scale: z.number().finite().min(0.1).max(10),
    zIndex: z.number().int().min(-1000).max(1000),
  })
  .strict();
export const outfitSchema = z
  .object({ name: z.string().trim().min(1).max(100), pieces: z.array(pieceSchema).min(1).max(30) })
  .strict();
export const referenceSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    imageUrl: imageUrlSchema,
    garmentIds: z.array(z.string().min(1).max(80)).max(30),
  })
  .strict();
export const wearSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return (
          Number.isFinite(date.getTime()) &&
          date.toISOString().slice(0, 10) === value &&
          value >= '2000-01-01' &&
          date.getTime() <= Date.now() + 86400000
        );
      }, 'Choose a valid date, no later than today.'),
  })
  .strict();
