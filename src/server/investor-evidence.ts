import { db } from './db';
import { growthPercent, ratio } from '@/lib/finance-metrics';

export async function investorEvidence(now = new Date()) {
  // Completed UTC days only: comparable windows, no partial-day growth inflation.
  const end = new Date(now.toISOString().slice(0, 10));
  const start = new Date(end.getTime() - 30 * 86400000);
  const previousStart = new Date(start.getTime() - 30 * 86400000);
  const from = start.toISOString().slice(0, 10),
    until = end.toISOString().slice(0, 10);
  const [accounts, recent, prior, active, ai, spend, shopping] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: start, lt: end } } }),
    db.user.count({ where: { createdAt: { gte: previousStart, lt: start } } }),
    db.$queryRaw<
      { active: number; repeat: number }[]
    >`SELECT COUNT(*)::int AS active, COUNT(*) FILTER (WHERE n>1)::int AS repeat FROM
      (SELECT "userId", COUNT(DISTINCT "day") n FROM "JourneyMetric" WHERE "day">=${from} AND "day"<${until} GROUP BY "userId") a`,
    db.agentRequest.aggregate({
      where: {
        createdAt: { gte: start, lt: end },
        state: 'succeeded',
        actualMicros: { not: null },
      },
      _count: { id: true },
      _sum: { actualMicros: true },
    }),
    db.agentBudget.aggregate({
      where: { scope: 'agents-v1:global', day: { gte: from, lt: until } },
      _sum: { spentMicros: true, heldMicros: true },
    }),
    db.$queryRaw<{ completed: number; returnedLinks: number }[]>`SELECT COUNT(*)::int AS completed,
      COUNT(*) FILTER (WHERE jsonb_array_length(CASE WHEN jsonb_typeof("result"->'listings')='array' THEN "result"->'listings' ELSE '[]'::jsonb END)>0)::int AS "returnedLinks"
      FROM "AgentRequest" WHERE agent='shop' AND state='succeeded' AND "createdAt">=${start} AND "createdAt"<${end}`,
  ]);
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    period: {
      fromInclusive: from,
      untilExclusive: until,
      days: 30,
      timezone: 'UTC',
      previousFromInclusive: previousStart.toISOString().slice(0, 10),
    },
    billing: {
      enabled: false,
      inAppSubscriptionMrrUsd: 0,
      inAppSubscriptionArrUsd: 0,
      scope:
        'FitStalker has no enabled paid subscription flow. External revenue or contracts are not connected.',
    },
    traction: {
      retainedAccounts: accounts,
      signups: recent,
      previousWindowSignups: prior,
      signupGrowthPercent: growthPercent(recent, prior),
      activeAccounts: active[0].active,
      activeOnMultipleDays: active[0].repeat,
      repeatActivityShare: ratio(active[0].repeat, active[0].active),
      completedShoppingSearches: shopping[0].completed,
      searchesReturningLinks: shopping[0].returnedLinks,
      returnedLinkShare: ratio(shopping[0].returnedLinks, shopping[0].completed),
    },
    costs: {
      recordedAiSpendUsd: (spend._sum.spentMicros ?? 0) / 1e6,
      reservedAiSpendUsd: (spend._sum.heldMicros ?? 0) / 1e6,
      settledSuccessfulRequests: ai._count.id,
      meanSettledSuccessCostUsd: ratio((ai._sum.actualMicros ?? 0) / 1e6, ai._count.id),
    },
    unavailable: {
      paidCustomerCac: 'No connected acquisition spend or paying-customer records.',
      costPerSignup: 'Acquisition spend and campaign attribution are not connected.',
      customerLifetimeValue: 'No observed paid retention, margin or churn cohorts.',
      revenueCagr: 'No positive recurring-revenue baseline or annual history.',
      cashBurnAndRunway: 'Cash balances and complete expenses are not connected.',
      externalCustomerCount: 'Internal/test accounts have not been comprehensively classified.',
    },
    sources: {
      accounts: 'Retained User records',
      activity: 'JourneyMetric daily account counters',
      shopping: 'Succeeded AgentRequest shop records',
      aiSpend: 'Global AgentBudget daily ledger',
      unitCost: 'Succeeded AgentRequest records with settled cost',
    },
    limitations: [
      'Operational snapshot, not audited financial statements or independently verified investor evidence.',
      'Retained accounts and usage may include internal/test activity; do not call them verified customers.',
      'Account deletion removes account-level history; signups here count retained records, not immutable historical registrations.',
      'Activity counters retain 30 days; tracking may not cover every day or action. Repeat activity is not cohort retention.',
      'Global AI spending includes deleted/test accounts; unit cost excludes deleted and unsettled request records. These measures have different populations.',
      'AI cost excludes hosting, tools, labor, marketing, payment fees and other expenses. A returned link does not prove accuracy or purchase availability.',
      'Projection inputs and hypothetical revenue are excluded from this export. No external bank, ad or billing records are connected.',
    ],
  };
}
