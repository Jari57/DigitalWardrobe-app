import { timingSafeEqual } from 'node:crypto';
import { refreshTrends } from '@/server/trend-feed';
import { handleError, json } from '@/server/http';
import { db } from '@/server/db';
import { checkOperations } from '@/server/operations';
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
    ? Buffer.from(`Bearer ${process.env.CRON_SECRET}`)
    : null;
  const supplied = Buffer.from(request.headers.get('authorization') ?? '');
  if (!expected || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return json({ error: 'Unauthorized' }, 401);
  try {
    await db.journeyMetric.deleteMany({
      where: { day: { lt: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) } },
    });
    const [feed, operations] = await Promise.all([refreshTrends(), checkOperations()]);
    return json({ ...feed, operations });
  } catch (error) {
    return handleError(error);
  }
}
