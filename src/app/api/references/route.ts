import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, readJson, ApiError } from '@/server/http';
import { ownGarments, ownImage, serializeReference } from '@/server/records';
import { referenceSchema } from '@/server/validation';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`reference:${user.id}`, 100, 3600);
    const input = await readJson(request, referenceSchema);
    const reference = await db.$transaction(async (tx) => {
      const imageId = await ownImage(user.id, input.imageUrl, tx);
      await ownGarments(user.id, input.garmentIds, tx);
      if ((await tx.reference.count({ where: { userId: user.id } })) >= 500)
        throw new ApiError(409, 'You have reached the 500-reference limit.');
      return tx.reference.create({
        data: {
          name: input.name,
          userId: user.id,
          imageId,
          garments: { create: [...new Set(input.garmentIds)].map((garmentId) => ({ garmentId })) },
        },
        include: { garments: true },
      });
    });
    return json({ reference: serializeReference(reference) }, 201);
  } catch (error) {
    return handleError(error);
  }
}
