import { z } from 'zod';

/** Product contracts only; provider calls and budget enforcement are separate launch work. */
export const agentPolicy = Object.freeze({
  version: '1',
  maxCandidates: 40,
  maxImages: 1,
  maxOutputTokens: 1200,
  requestsPerUserPerDay: 10,
  automaticRetries: 0,
});

const id = z.string().min(1).max(80);
const note = z.string().trim().min(1).max(500);
const category = z.enum(['tops', 'bottoms', 'outerwear', 'shoes', 'accessories', 'dresses']);
const uniqueIds = z
  .array(id)
  .max(agentPolicy.maxCandidates)
  .refine((values) => new Set(values).size === values.length, 'Garment IDs must be unique.');

export const agentRequestSchema = z.discriminatedUnion('agent', [
  z.object({ agent: z.literal('detect'), imageId: id }).strict(),
  z
    .object({
      agent: z.literal('shop'),
      detectionId: id,
      itemIndex: z.number().int().min(0).max(5),
      country: z.enum(['US', 'GB', 'CA', 'AU']),
    })
    .strict(),
  z.object({ agent: z.literal('capture'), imageId: id }).strict(),
  z.object({ agent: z.literal('spotter'), imageId: id, candidateIds: uniqueIds }).strict(),
  z
    .object({
      agent: z.literal('stylist'),
      candidateIds: uniqueIds,
      lockedIds: uniqueIds,
      occasion: z.string().trim().min(1).max(120),
      aesthetic: z.string().trim().max(120),
    })
    .strict(),
  z
    .object({
      agent: z.literal('creator'),
      outfitId: id,
      tone: z.enum(['playful', 'minimal', 'confident']),
    })
    .strict(),
]);

export const captureResultSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    category,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    uncertaintyNotes: z.array(note).max(4),
  })
  .strict();

export const stylistResultSchema = z
  .object({
    garmentIds: z.array(id).min(1).max(12),
    explanation: note,
    limitations: z.array(note).max(4),
  })
  .strict();

export const spotterResultSchema = z
  .object({
    elements: z
      .array(z.object({ description: note, garmentId: id.nullable(), explanation: note }).strict())
      .max(12),
    limitations: z.array(note).max(4),
  })
  .strict();

export const creatorResultSchema = z
  .object({
    caption: z.string().trim().min(1).max(160),
    filmingSteps: z.array(z.string().trim().min(1).max(240)).min(1).max(5),
  })
  .strict();

export function validateStylistResult(
  value: unknown,
  ownedCandidateIds: readonly string[],
  lockedIds: readonly string[],
) {
  // Caller must supply IDs loaded from an authenticated, owner-scoped DB query.
  const result = stylistResultSchema.parse(value);
  const owned = new Set(ownedCandidateIds);
  const selected = new Set(result.garmentIds);
  if (selected.size !== result.garmentIds.length)
    throw new Error('Duplicate garment in proposed outfit.');
  if (result.garmentIds.some((id) => !owned.has(id)))
    throw new Error('Proposal contains an unavailable garment.');
  if (lockedIds.some((id) => !owned.has(id) || !selected.has(id)))
    throw new Error('Proposal did not preserve locked pieces.');
  return result;
}

export function validateSpotterResult(value: unknown, ownedCandidateIds: readonly string[]) {
  const result = spotterResultSchema.parse(value);
  const owned = new Set(ownedCandidateIds);
  const matched = result.elements.flatMap((element) =>
    element.garmentId ? [element.garmentId] : [],
  );
  if (new Set(matched).size !== matched.length)
    throw new Error('Duplicate garment in reference pairing.');
  if (
    result.elements.some((element) => element.garmentId !== null && !owned.has(element.garmentId))
  ) {
    throw new Error('Reference pairing contains an unavailable garment.');
  }
  return result;
}
