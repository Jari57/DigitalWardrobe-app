import { z } from 'zod';
import { requireUser, rateLimit, signOut, verifyPassword, hashPassword, createSession } from '@/server/auth';
import { passwordSchema } from '@/server/validation';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, readJson, ApiError } from '@/server/http';
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`password-change:${user.id}`, 5, 900);
    const input = await readJson(request, z.object({ password: z.string().min(1).max(128), newPassword: passwordSchema }).strict());
    const record = await db.user.findUnique({ where: { id: user.id } });
    if (!record || !await verifyPassword(input.password, record.passwordHash)) throw new ApiError(401, 'Password is incorrect.');
    const passwordHash = await hashPassword(input.newPassword);
    await db.$transaction(async tx => {
      const changed = await tx.user.updateMany({ where: { id: user.id, passwordHash: record.passwordHash }, data: { passwordHash } });
      if (changed.count !== 1) throw new ApiError(409, 'Your password changed in another session. Sign in again.');
      await tx.session.deleteMany({ where: { userId: user.id } });
    });
    await createSession(user.id);
    return json({ ok: true });
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`delete-account:${user.id}`, 5, 900);
    const input = await readJson(request, z.object({ password: z.string().min(1).max(128) }).strict());
    const record = await db.user.findUnique({ where: { id: user.id } });
    if (!record || !await verifyPassword(input.password, record.passwordHash)) throw new ApiError(401, 'Password is incorrect.');
    await db.$transaction(async tx => {
      // Explicit ordering also satisfies restricted photo foreign keys.
      await tx.garment.deleteMany({ where: { userId: user.id } });
      await tx.reference.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    });
    await signOut();
    return json({ ok: true });
  } catch (error) { return handleError(error); }
}
