import { AsyncLocalStorage } from 'node:async_hooks';
import { db } from '@/server/db';
const usageContext = new AsyncLocalStorage<{ userId: string; requestId: string }>();
export function withAgentUsage<T>(userId: string, requestId: string, action: () => Promise<T>) {
  return usageContext.run({ userId, requestId }, action);
}
export async function recordGeneration(id: unknown, costMicros: number | null) {
  const context = usageContext.getStore();
  if (!context || typeof id !== 'string' || !id || id.length > 200) return;
  if (!(await db.agentRequest.count({ where: { id: context.requestId, userId: context.userId } })))
    throw new Error('Generation owner no longer exists.');
  await db.agentGeneration.upsert({
    where: { id, requestId: context.requestId },
    create: { id, requestId: context.requestId, costMicros },
    update: costMicros === null ? {} : { costMicros },
  });
}

// Persist the receipt before structured-output validation can reject a completed call.
export async function recordStepUsage(step: {
  providerMetadata?: Record<string, Record<string, unknown>>;
}) {
  const receipt = step.providerMetadata?.gateway;
  const raw = receipt?.cost;
  const cost =
    typeof raw === 'number' || (typeof raw === 'string' && raw.trim()) ? Number(raw) : NaN;
  await recordGeneration(
    receipt?.generationId,
    Number.isFinite(cost) && cost >= 0 ? Math.ceil(cost * 1_000_000) : null,
  );
}
