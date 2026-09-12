import { requireUser } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, ApiError } from '@/server/http';
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    if (!(await db.outfit.deleteMany({ where: { id, userId: user.id } })).count) throw new ApiError(404, 'Look not found.');
    return json({ ok: true });
  } catch (error) { return handleError(error); }
}
