import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { requireUser, rateLimit } from '@/server/auth';
import { ApiError, checkOrigin, handleError, json, readJson } from '@/server/http';
import {
  defaultShoppingPreferences,
  draftSchema,
  shoppingPreferencesSchema,
} from '@/lib/experience';
export async function GET() {
  try {
    const user = await requireUser();
    const record = await db.userExperience.findUnique({ where: { userId: user.id } });
    const parsed = draftSchema.safeParse(record?.draft);
    const owned = await db.garment.findMany({ where: { userId: user.id }, select: { id: true } });
    const ids = new Set(owned.map((g) => g.id));
    return json({
      preferences: record
        ? {
            region: record.region,
            currency: record.currency,
            maxPrice: record.maxPrice,
            sizes: record.sizes,
          }
        : defaultShoppingPreferences,
      draft: parsed.success ? parsed.data.filter((p) => ids.has(p.garmentId)) : [],
    });
  } catch (error) {
    return handleError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`experience:${user.id}`, 120, 3600);
    const input = await readJson(
      request,
      z.discriminatedUnion('kind', [
        z
          .object({ kind: z.literal('preferences'), preferences: shoppingPreferencesSchema })
          .strict(),
        z.object({ kind: z.literal('draft'), pieces: draftSchema }).strict(),
      ]),
    );
    if (input.kind === 'draft') {
      const owned = await db.garment.count({
        where: { userId: user.id, id: { in: input.pieces.map((p) => p.garmentId) } },
      });
      if (owned !== input.pieces.length)
        throw new ApiError(404, 'A piece is no longer in your closet. Refresh and try again.');
    }
    const data =
      input.kind === 'preferences'
        ? input.preferences
        : { draft: input.pieces.length ? input.pieces : Prisma.DbNull };
    await db.userExperience.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
