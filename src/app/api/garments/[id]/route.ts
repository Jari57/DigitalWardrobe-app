import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, readJson, ApiError } from '@/server/http';
import { ownImage, serializeGarment } from '@/server/records';
import { garmentSchema } from '@/server/validation';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`garment-edit:${user.id}`, 200, 3600);
    const { id } = await context.params;
    const { imageUrl, ...input } = await readJson(request, garmentSchema.partial());
    const garment = await db.$transaction(async tx => {
      if (!await tx.garment.findFirst({ where: { id, userId: user.id } })) throw new ApiError(404, 'Garment not found.');
      const imageId = imageUrl ? await ownImage(user.id, imageUrl, tx) : undefined;
      return tx.garment.update({ where: { id, userId: user.id }, data: { ...input, imageId } });
    });
    return json({ garment: serializeGarment(garment) });
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const removed = await db.garment.deleteMany({ where: { id, userId: user.id } });
    if (!removed.count) throw new ApiError(404, 'Garment not found.');
    // Foreign-key cascades remove only the deleted piece from saved compositions.
    return json({ ok: true });
  } catch (error) { return handleError(error); }
}
