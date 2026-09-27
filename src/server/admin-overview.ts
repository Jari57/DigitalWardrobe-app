import { db } from './db';
import { serviceControl } from './service-control';
export async function adminOverview(days: number) {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const start = new Date(`${since}T00:00:00Z`);
  const [
    users,
    newUsers,
    garments,
    outfits,
    traffic,
    actions,
    agents,
    recent,
    people,
    budget,
    refresh,
    control,
    audit,
    shopping,
    active,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: start } } }),
    db.garment.count(),
    db.outfit.count(),
    db.$queryRaw<
      {
        day: string;
        page: string;
        channel: string;
        device: string;
        signedIn: boolean;
        views: number;
      }[]
    >`SELECT * FROM "TrafficDaily" WHERE "day" >= ${since} ORDER BY "day"`,
    db.journeyMetric.groupBy({
      by: ['event'],
      where: { day: { gte: since } },
      _sum: { count: true },
    }),
    db.$queryRaw<{ agent: string; state: string; count: number; cost: number; tokens: number }[]>`
      SELECT "agent", "state", COUNT(*)::int AS "count", COALESCE(SUM("actualMicros"),0)::float8 AS "cost",
      COALESCE(SUM(COALESCE("inputTokens",0)+COALESCE("outputTokens",0)),0)::float8 AS "tokens"
      FROM "AgentRequest" WHERE "createdAt" >= ${start} GROUP BY "agent", "state" ORDER BY "agent", "state"`,
    db.agentRequest.findMany({
      where: { createdAt: { gte: start } },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        agent: true,
        state: true,
        actualMicros: true,
        createdAt: true,
        user: { select: { username: true } },
      },
    }),
    db.$queryRaw<
      {
        id: string;
        username: string;
        createdAt: Date;
        lastActive: string | null;
        requests: number;
        spend: number;
      }[]
    >`
      SELECT u."id", u."username", u."createdAt", j."lastActive", COALESCE(a."requests",0)::int AS "requests", COALESCE(a."spend",0)::float8 AS "spend"
      FROM "User" u
      LEFT JOIN (SELECT "userId", MAX("day") AS "lastActive" FROM "JourneyMetric" GROUP BY "userId") j ON j."userId"=u."id"
      LEFT JOIN (SELECT "userId", COUNT(*) AS "requests", SUM("actualMicros") AS "spend" FROM "AgentRequest" WHERE "createdAt">=${start} GROUP BY "userId") a ON a."userId"=u."id"
      ORDER BY j."lastActive" DESC NULLS LAST, u."createdAt" DESC LIMIT 50`,
    db.agentBudget.findUnique({ where: { scope_day: { scope: 'agents-v1:global', day: today } } }),
    db.trendRefresh.findFirst({ select: { lastSuccess: true, failedSources: true } }),
    serviceControl(),
    db.$queryRaw<
      {
        id: string;
        username: string | null;
        createdAt: Date;
        details: {
          after: {
            aiPaused: boolean;
            dailyCapMicros: number | null;
            requestsPerUser: number | null;
          };
        };
      }[]
    >`
      SELECT a."id", u."username", a."createdAt", a."details" FROM "AdminAudit" a LEFT JOIN "User" u ON a."actorId"=u."id" ORDER BY a."createdAt" DESC LIMIT 20`,
    db.$queryRaw<
      { searches: number; withResults: number; photos: number; listings: number; exact: number }[]
    >`
      WITH searches AS (SELECT CASE WHEN jsonb_typeof("result"->'listings')='array' THEN "result"->'listings' ELSE '[]'::jsonb END AS items
        FROM "AgentRequest" WHERE "agent"='shop' AND "state"='succeeded' AND "createdAt">=${start})
      SELECT COUNT(*)::int AS "searches", COUNT(*) FILTER (WHERE jsonb_array_length(items)>0)::int AS "withResults",
      COALESCE(SUM((SELECT COUNT(*) FROM jsonb_array_elements(items) l WHERE l->'evidence'->>'imageUrl' IS NOT NULL)),0)::int AS "photos",
      COALESCE(SUM(jsonb_array_length(items)),0)::int AS "listings",
      COALESCE(SUM((SELECT COUNT(*) FROM jsonb_array_elements(items) l WHERE l->>'identityEvidence'='matching-code-and-visuals')),0)::int AS "exact" FROM searches`,
    db.$queryRaw<{ active: number; returning: number }[]>`
      SELECT COUNT(*)::int AS "active", COUNT(*) FILTER (WHERE n>1)::int AS "returning" FROM
      (SELECT "userId", COUNT(DISTINCT "day") AS n FROM "JourneyMetric" WHERE "day">=${since} GROUP BY "userId") x`,
  ]);
  return {
    users,
    newUsers,
    garments,
    outfits,
    traffic,
    actions,
    agents,
    recent,
    people,
    budget,
    refresh,
    control,
    audit,
    shopping: shopping[0],
    active: active[0],
    today,
    since,
  };
}
