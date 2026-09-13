import { timingSafeEqual } from 'node:crypto';
import { refreshTrends } from '@/server/trend-feed';
import { handleError, json } from '@/server/http';
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
    ? Buffer.from(`Bearer ${process.env.CRON_SECRET}`)
    : null;
  const supplied = Buffer.from(request.headers.get('authorization') ?? '');
  if (!expected || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return json({ error: 'Unauthorized' }, 401);
  try {
    return json(await refreshTrends());
  } catch (error) {
    return handleError(error);
  }
}
