import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, readJson, ApiError } from '@/server/http';
import { imageIdFromUrl, ownImage, serializeGarment } from '@/server/records';
import { garmentCreateSchema, imageUrlSchema } from '@/server/validation';
import { recordJourney } from '@/server/journey';
import { detectedItemSchema } from '@/lib/discovery';
import { garmentReference } from '@/server/agents/garment-crop';
import { normalizeImage } from '@/server/images';

async function cropScannedPiece(userId: string, scan: { id: string; itemIndex: number }) {
  const entry = await db.agentRequest.findFirst({
    where: { id: scan.id, userId, agent: 'detect' },
    select: { result: true },
  });
  const result = entry?.result;
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw new ApiError(404, 'This scan is unavailable.');
  const item = detectedItemSchema.safeParse(
    Array.isArray(result.items) && result.items[scan.itemIndex],
  );
  const source = imageUrlSchema.safeParse(result.imageUrl);
  if (!item.success || !source.success)
    throw new ApiError(404, 'This scanned piece is unavailable.');
  if (!item.data.bounds)
    throw new ApiError(422, 'Upload a photo of this item. The scan could not isolate it.');
  const original = await db.image.findFirst({
    where: { id: imageIdFromUrl(source.data), userId },
    select: { data: true },
  });
  if (!original) throw new ApiError(404, 'The original scan photo is unavailable.');
  const crop = await garmentReference(original.data, item.data.bounds, { requireCrop: true });
  if (!crop) throw new ApiError(422, 'Upload a photo of this item. The scan could not isolate it.');
  return normalizeImage(crop);
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`garment:${user.id}`, 100, 3600);
    const requestData = await readJson(request, garmentCreateSchema);
    const { imageUrl, scan, ...input } = {
      imageUrl: undefined,
      scan: undefined,
      ...requestData,
    };
    const crop = scan ? await cropScannedPiece(user.id, scan) : null;
    const garment = await db.$transaction(async (tx) => {
      if ((await tx.garment.count({ where: { userId: user.id } })) >= 1000)
        throw new ApiError(409, 'Your closet has reached its 1,000-item limit.');
      if (crop && (await tx.image.count({ where: { userId: user.id } })) >= 1500)
        throw new ApiError(409, 'Your photo storage is full. Remove items you no longer need.');
      const imageId = crop
        ? (await tx.image.create({ data: { ...crop, userId: user.id }, select: { id: true } })).id
        : await ownImage(user.id, imageUrl!, tx);
      return tx.garment.create({ data: { ...input, imageId, userId: user.id } });
    });
    await recordJourney(user.id, 'piece_saved');
    return json({ garment: serializeGarment(garment) }, 201);
  } catch (error) {
    return handleError(error);
  }
}
