import { z } from 'zod';
import { requireUser, rateLimit, signOut, verifyPassword } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, readJson, ApiError } from '@/server/http';
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
