import { z } from 'zod';
import {
  requireUser,
  rateLimit,
  signOut,
  verifyPassword,
  hashPassword,
  createSession,
} from '@/server/auth';
import { passwordSchema } from '@/server/validation';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, readJson, ApiError } from '@/server/http';
import { verifyGoogleIdentity } from '@/server/google';
const credentials = z.object({
  password: z.string().min(1).max(128).optional(),
  idToken: z.string().min(100).max(10000).optional(),
});
async function confirmOwner(userId: string, input: { password?: string; idToken?: string }) {
  const record = await db.user.findUnique({ where: { id: userId } });
  if (!record) throw new ApiError(401, 'Sign in again.');
  if (input.idToken) {
    const identity = await verifyGoogleIdentity(input.idToken);
    if (!record.googleUid || identity.uid !== record.googleUid)
      throw new ApiError(401, 'Choose the Google account linked to this closet.');
  } else if (!input.password || !(await verifyPassword(input.password, record.passwordHash)))
    throw new ApiError(401, 'Password is incorrect.');
  return record;
}
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`password-change:${user.id}`, 5, 900);
    const input = await readJson(
      request,
      credentials.extend({ newPassword: passwordSchema }).strict(),
    );
    const record = await confirmOwner(user.id, input);
    const passwordHash = await hashPassword(input.newPassword);
    await db.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: user.id, passwordHash: record.passwordHash },
        data: { passwordHash },
      });
      if (changed.count !== 1)
        throw new ApiError(409, 'Your password changed in another session. Sign in again.');
      await tx.session.deleteMany({ where: { userId: user.id } });
    });
    await createSession(user.id, !!input.idToken);
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`delete-account:${user.id}`, 5, 900);
    const input = await readJson(request, credentials.strict());
    await confirmOwner(user.id, input);
    await db.$transaction(async (tx) => {
      // Explicit ordering also satisfies restricted photo foreign keys.
      await tx.garment.deleteMany({ where: { userId: user.id } });
      await tx.reference.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    });
    await signOut();
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
