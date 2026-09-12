import { Prisma } from '@prisma/client';
import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, readJson, ApiError } from '@/server/http';
import { wearSchema } from '@/server/validation';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`wear:${user.id}`, 100, 3600);
    const { id } = await context.params;
    const { date } = await readJson(request, wearSchema);
    try {
      const recorded = await db.$transaction(async tx => {
        const outfit = await tx.outfit.findFirst({ where: { id, userId: user.id }, include: { pieces: true } });
        if (!outfit) throw new ApiError(404, 'Look not found.');
        if (await tx.wearEvent.findUnique({ where: { outfitId_date: { outfitId: id, date } } })) return false;
        const garmentIds = [...new Set(outfit.pieces.map(piece => piece.garmentId))];
        if (!garmentIds.length) throw new ApiError(400, 'This look has no garments left.');
        await tx.wearEvent.create({ data: { outfitId: id, date, garments: { create: garmentIds.map(garmentId => ({ garmentId })) } } });
        await tx.garment.updateMany({ where: { id: { in: garmentIds }, userId: user.id }, data: { wearCount: { increment: 1 } } });
        return true;
      });
      return json({ ok: true, recorded });
    } catch (error) {
      // Concurrent repeated requests share the same unique (outfit,date) key.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return json({ ok: true, recorded: false });
      throw error;
    }
  } catch (error) { return handleError(error); }
}
