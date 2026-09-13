import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/server/db';
import { createSession, rateLimit, requestIp, sessionUser } from '@/server/auth';
import { ApiError, checkOrigin, handleError, json, readJson } from '@/server/http';
import { verifyGoogleIdentity } from '@/server/google';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await rateLimit(`google-auth:${requestIp(request)}`, 30, 900);
    const input = await readJson(
      request,
      z
        .object({ idToken: z.string().min(100).max(10000), link: z.boolean().default(false) })
        .strict(),
    );
    const identity = await verifyGoogleIdentity(input.idToken);
    const current = await sessionUser();
    if (input.link && !current)
      throw new ApiError(401, 'Sign in to your existing closet before linking Google.');
    const user = await db.$transaction(async (tx) => {
      const linked = await tx.user.findUnique({ where: { googleUid: identity.uid } });
      if (input.link && current) {
        if (linked && linked.id !== current.id)
          throw new ApiError(
            409,
            'This Google account already belongs to another closet. Accounts were not merged.',
          );
        const owner = await tx.user.findUniqueOrThrow({ where: { id: current.id } });
        if (owner.googleUid && owner.googleUid !== identity.uid)
          throw new ApiError(409, 'This closet already has a different Google account linked.');
        return tx.user.update({
          where: { id: current.id },
          data: { googleUid: identity.uid, googleEmail: identity.email },
        });
      }
      if (current && (!linked || linked.id !== current.id))
        throw new ApiError(
          409,
          'Sign out before switching accounts, or use Link Google in account settings.',
        );
      if (linked)
        return tx.user.update({ where: { id: linked.id }, data: { googleEmail: identity.email } });
      return tx.user.create({
        data: {
          username: `style_${randomBytes(8).toString('hex')}`,
          googleUid: identity.uid,
          googleEmail: identity.email,
          passwordHash: 'google-only',
          recoveryHash: 'google-only',
        },
      });
    });
    await createSession(user.id, true);
    return json({ user: { id: user.id, username: user.username } });
  } catch (error) {
    return handleError(error);
  }
}
