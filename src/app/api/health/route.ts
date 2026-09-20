import { db } from '@/server/db';
import { json } from '@/server/http';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    // Probe an application table too: an empty, unmigrated database is not ready.
    await db.user.count();
    await db.userExperience.findFirst({ select: { userId: true } });
    await db.journeyMetric.findFirst({ select: { userId: true } });
    return json({
      ok: true,
      database: 'ready',
      billing: 'off',
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    });
  } catch {
    return json({ ok: false, database: 'unavailable' }, 503);
  }
}
