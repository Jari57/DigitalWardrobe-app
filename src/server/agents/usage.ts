import { gateway } from 'ai';
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

type Meter = { providerMetadata?: Record<string, Record<string, unknown>> };

export async function generationCost(result: Meter): Promise<number | null> {
  const id = result.providerMetadata?.gateway?.generationId;
  let measured: number | null = null;
  const raw = result.providerMetadata?.gateway?.cost;
  if ((typeof raw === 'string' && raw.trim() !== '') || typeof raw === 'number') {
    const cost = Number(raw);
    if (Number.isFinite(cost) && cost >= 0) measured = Math.ceil(cost * 1_000_000);
  }
  if (measured === null && typeof id === 'string')
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const info = await Promise.race([
        gateway.getGenerationInfo({ id }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Cost lookup timed out')), 3000);
        }),
      ]).finally(() => clearTimeout(timer));
      measured =
        Number.isFinite(info.totalCost) && info.totalCost >= 0
          ? Math.ceil(info.totalCost * 1_000_000)
          : null;
    } catch {
      /* Keep unknown cost reserved until reconciliation. */
    }
  await recordGeneration(id, measured);
  return measured;
}
