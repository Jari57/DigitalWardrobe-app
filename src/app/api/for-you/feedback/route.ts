import { z } from 'zod';
import { db } from '@/server/db';
import { requireUser, rateLimit } from '@/server/auth';
import { ApiError, checkOrigin, handleError, json, readJson } from '@/server/http';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`trend-feedback:${user.id}`, 120, 3600);
    const { itemId, action } = await readJson(
      request,
      z
        .object({
          itemId: z.string().max(80),
          action: z.enum(['like', 'unlike', 'save', 'unsave', 'hide', 'show']),
        })
        .strict(),
    );
    if (!(await db.trendItem.count({ where: { id: itemId } })))
      throw new ApiError(404, 'This idea is no longer available.');
    const data =
      action === 'hide'
        ? { hidden: true }
        : action === 'show'
          ? { hidden: false }
          : action === 'like' || action === 'unlike'
            ? { liked: action === 'like' }
            : { saved: action === 'save' };
    await db.trendFeedback.upsert({
      where: { userId_itemId: { userId: user.id, itemId } },
      create: { userId: user.id, itemId, ...data },
      update: data,
    });
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
