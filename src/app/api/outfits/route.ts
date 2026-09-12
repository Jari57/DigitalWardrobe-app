import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, readJson, ApiError } from '@/server/http';
import { ownGarments, serializeOutfit } from '@/server/records';
import { outfitSchema } from '@/server/validation';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`outfit:${user.id}`, 100, 3600);
    const input = await readJson(request, outfitSchema);
    const outfit = await db.$transaction(async tx => {
      await ownGarments(user.id, input.pieces.map(p => p.garmentId), tx);
      if (await tx.outfit.count({ where: { userId: user.id } }) >= 1000) throw new ApiError(409, 'Your lookbook has reached its 1,000-look limit.');
      return tx.outfit.create({ data: { name: input.name, userId: user.id, pieces: { create: input.pieces } }, include: { pieces: true } });
    });
    return json({ outfit: serializeOutfit(outfit) }, 201);
  } catch (error) { return handleError(error); }
}
