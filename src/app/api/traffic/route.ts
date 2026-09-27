import { sessionUser, rateLimit, requestIp } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, readJson, json, handleError } from '@/server/http';
import { trafficSchema } from '@/lib/traffic';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (
      request.headers.get('dnt') === '1' ||
      request.headers.get('sec-gpc') === '1' ||
      /bot|crawler|spider|headless/i.test(request.headers.get('user-agent') ?? '')
    )
      return json({ ok: true });
    await rateLimit(`traffic:${requestIp(request)}`, 60, 60);
    const input = await readJson(request, trafficSchema);
    const signedIn = !!(await sessionUser());
    const day = new Date().toISOString().slice(0, 10);
    await db.$executeRaw`INSERT INTO "TrafficDaily" ("day", "page", "channel", "device", "signedIn", "views")
      VALUES (${day}, ${input.page}, ${input.channel}, ${input.device}, ${signedIn}, 1)
      ON CONFLICT ("day", "page", "channel", "device", "signedIn") DO UPDATE SET "views" = "TrafficDaily"."views" + 1`;
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    await db.$executeRaw`DELETE FROM "TrafficDaily" WHERE "day" < ${cutoff}`;
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
