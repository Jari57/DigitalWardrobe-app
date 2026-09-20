import { z } from 'zod';
import { requireUser, rateLimit } from '@/server/auth';
import { checkOrigin, handleError, json, readJson } from '@/server/http';
import { recordJourney } from '@/server/journey';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`journey:${user.id}`, 120, 3600);
    const { event } = await readJson(
      request,
      z.object({ event: z.enum(['visit', 'retailer_click']) }).strict(),
    );
    await recordJourney(user.id, event);
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
