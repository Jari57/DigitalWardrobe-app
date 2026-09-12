import { requireUser } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, ApiError, readJson } from '@/server/http';
import { z } from 'zod';
import { ownGarments, serializeReference } from '@/server/records';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const { garmentIds } = await readJson(
      request,
      z.object({ garmentIds: z.array(z.string().min(1).max(80)).max(30) }).strict(),
    );
    const reference = await db.$transaction(async (tx) => {
      if (!(await tx.reference.findFirst({ where: { id, userId: user.id }, select: { id: true } })))
        throw new ApiError(404, 'Reference not found.');
      await ownGarments(user.id, garmentIds, tx);
      return tx.reference.update({
        where: { id, userId: user.id },
        data: {
          garments: {
            deleteMany: {},
            create: [...new Set(garmentIds)].map((garmentId) => ({ garmentId })),
          },
        },
        include: { garments: true },
      });
    });
    return json({ reference: serializeReference(reference) });
  } catch (error) {
    return handleError(error);
  }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    if (!(await db.reference.deleteMany({ where: { id, userId: user.id } })).count)
      throw new ApiError(404, 'Reference not found.');
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
