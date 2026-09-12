import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, readJson, ApiError } from '@/server/http';
import { ownImage, serializeGarment } from '@/server/records';
import { garmentSchema } from '@/server/validation';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`garment:${user.id}`, 100, 3600);
    const { imageUrl, ...input } = await readJson(request, garmentSchema);
    const garment = await db.$transaction(async (tx) => {
      const imageId = await ownImage(user.id, imageUrl, tx);
      if ((await tx.garment.count({ where: { userId: user.id } })) >= 1000)
        throw new ApiError(409, 'Your closet has reached its 1,000-item limit.');
      return tx.garment.create({ data: { ...input, imageId, userId: user.id } });
    });
    return json({ garment: serializeGarment(garment) }, 201);
  } catch (error) {
    return handleError(error);
  }
}
