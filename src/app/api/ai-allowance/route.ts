import { createHash } from 'node:crypto';
import { requireUser } from '@/server/auth';
import { db } from '@/server/db';
import { json, handleError } from '@/server/http';
import { configuredAgentBudget } from '@/server/agents/ledger';
export async function GET() {
  try {
    const user = await requireUser();
    if (process.env.AI_ENABLED !== 'true') return json({ enabled: false });
    const policy = configuredAgentBudget(),
      now = new Date(),
      day = now.toISOString().slice(0, 10);
    const scope = 'agents-v1:user:' + createHash('sha256').update(user.id).digest('hex');
    const budgets = await db.agentBudget.findMany({
      where: { day, scope: { in: [scope, 'agents-v1:global'] } },
    });
    const own = budgets.find((b) => b.scope === scope),
      global = budgets.find((b) => b.scope === 'agents-v1:global');
    return json({
      enabled: true,
      remaining: Math.max(0, policy.requestsPerUser - (own?.requests ?? 0)),
      limit: policy.requestsPerUser,
      sharedLimitReached:
        (global?.heldMicros ?? 0) + (global?.spentMicros ?? 0) + policy.maxRequestMicros >
        policy.dailyCapMicros,
      resetsAt: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
      ).toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
}
