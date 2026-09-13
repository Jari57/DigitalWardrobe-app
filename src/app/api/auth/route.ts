import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/server/db';
import { checkOrigin, readJson, json, handleError, ApiError } from '@/server/http';
import {
  createSession,
  hashPassword,
  hashToken,
  rateLimit,
  recoveryCode,
  requestIp,
  signOut,
  verifyPassword,
} from '@/server/auth';
import { passwordSchema, usernameSchema } from '@/server/validation';

export const runtime = 'nodejs';
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('signout') }).strict(),
  z
    .object({ action: z.literal('signup'), username: usernameSchema, password: passwordSchema })
    .strict(),
  z
    .object({
      action: z.literal('signin'),
      username: usernameSchema,
      password: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({
      action: z.literal('recover'),
      username: usernameSchema,
      password: passwordSchema,
      recoveryCode: z.string().trim().min(1).max(128),
    })
    .strict(),
]);
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await rateLimit(`auth:ip:${requestIp(request)}`, 30, 900);
    const input = await readJson(request, schema);
    if (input.action === 'signout') {
      await signOut();
      return json({ user: null });
    }
    await rateLimit(`auth:username:${input.username}`, 15, 900);
    if (input.action === 'signup') {
      const code = recoveryCode();
      const passwordHash = await hashPassword(input.password);
      const user = await db.user.create({
        data: { username: input.username, passwordHash, recoveryHash: hashToken(code) },
        select: { id: true, username: true },
      });
      await createSession(user.id);
      return json({ user, recoveryCode: code }, 201);
    }
    const found = await db.user.findUnique({ where: { username: input.username } });
    if (input.action === 'signin') {
      // Derive a dummy hash too, so unknown usernames do not take a fast path.
      const valid = found
        ? await verifyPassword(input.password, found.passwordHash)
        : (await hashPassword(input.password), false);
      if (!found || !valid) throw new ApiError(401, 'Username or password is incorrect.');
      await createSession(found.id);
      return json({ user: { id: found.id, username: found.username } });
    }
    const candidateHash = hashToken(input.recoveryCode);
    if (
      !found ||
      !/^[a-f0-9]{64}$/.test(found.recoveryHash) ||
      !timingSafeEqual(Buffer.from(found.recoveryHash, 'hex'), Buffer.from(candidateHash, 'hex'))
    )
      throw new ApiError(401, 'Username or recovery code is incorrect.');
    const code = recoveryCode();
    const passwordHash = await hashPassword(input.password);
    await db.$transaction(async (tx) => {
      // Compare-and-swap makes each recovery code usable only once, even concurrently.
      const changed = await tx.user.updateMany({
        where: { id: found.id, recoveryHash: candidateHash },
        data: { passwordHash, recoveryHash: hashToken(code) },
      });
      if (changed.count !== 1) throw new ApiError(401, 'This recovery code is no longer valid.');
      await tx.session.deleteMany({ where: { userId: found.id } });
    });
    await createSession(found.id);
    return json({ user: { id: found.id, username: found.username }, recoveryCode: code });
  } catch (error) {
    return handleError(error);
  }
}
