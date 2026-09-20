import { gateway } from 'ai';
import { Prisma, type PrismaClient } from '@prisma/client';
import { AgentLedger, configuredAgentBudget } from './ledger';
async function lookupCost(id: string): Promise<number | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const info = await Promise.race([
      gateway.getGenerationInfo({ id }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Cost lookup timed out')), 3000);
      }),
    ]);
    return Number.isFinite(info.totalCost) && info.totalCost >= 0
      ? Math.ceil(info.totalCost * 1_000_000)
      : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
// Only complete, persisted results with every provider receipt can be settled.
// Partial/unknown dispatches keep their hold; never infer a refund from a timeout.
export async function reconcileCompleted(db: PrismaClient, userId: string, lookup = lookupCost) {
  const records = await db.agentRequest.findMany({
    where: {
      userId,
      state: 'uncertain',
      result: { not: Prisma.DbNull },
      generations: { some: {} },
    },
    include: { generations: true },
    orderBy: { updatedAt: 'asc' },
    take: 5,
  });
  const ledger = new AgentLedger(db, configuredAgentBudget());
  let resolved = 0;
  for (const record of records) {
    const value = record.result as Prisma.JsonObject;
    const expected =
      record.agent === 'shop'
        ? value.generationCount === 1
          ? 1
          : value.generationCount === 3
            ? 3
            : 2
        : 1;
    if (record.generations.length !== expected) continue;
    const costs = await Promise.all(
      record.generations.map(async (generation) => {
        if (generation.costMicros !== null) return generation.costMicros;
        const cost = await lookup(generation.id);
        if (cost !== null && Number.isSafeInteger(cost) && cost >= 0)
          await db.agentGeneration.updateMany({
            where: { id: generation.id, requestId: record.id },
            data: { costMicros: cost },
          });
        return cost;
      }),
    );
    if (costs.some((cost) => cost === null || !Number.isSafeInteger(cost) || cost < 0)) continue;
    await ledger.settle(userId, record.id, {
      state: 'succeeded',
      actualMicros: costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0),
      inputTokens: record.inputTokens ?? 0,
      outputTokens: record.outputTokens ?? 0,
      result: value,
    });
    resolved++;
  }
  const unresolved = await db.agentRequest.count({
    where: { userId, state: { in: ['uncertain', 'dispatched'] } },
  });
  return { resolved, unresolved };
}
