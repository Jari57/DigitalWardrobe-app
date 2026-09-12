import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, ApiError } from '@/server/http';
import { reconcileCompleted } from '@/server/agents/recovery';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`ai-recovery:${user.id}`, 4, 3600);
    if (process.env.AI_ENABLED !== 'true') throw new ApiError(503, 'AI service is disabled.');
    return json(await reconcileCompleted(db, user.id));
  } catch (error) {
    return handleError(error);
  }
}
