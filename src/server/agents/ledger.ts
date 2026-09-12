import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { agentRequestSchema, agentPolicy } from './contracts';

const policySchema = z.object({
  dailyCapMicros: z.number().int().min(1).max(1_000_000_000),
  maxRequestMicros: z.number().int().min(1).max(1_000_000),
  requestsPerUser: z.number().int().min(1).max(100),
}).refine(p => p.maxRequestMicros <= p.dailyCapMicros);
export type BudgetPolicy = z.infer<typeof policySchema>;

export function configuredAgentBudget(): BudgetPolicy {
  if (process.env.AI_ENABLED !== 'true') throw new Error('AI generation is not enabled.');
  return policySchema.parse({
    dailyCapMicros: Number(process.env.AI_DAILY_CAP_MICROS),
    maxRequestMicros: Number(process.env.AI_MAX_REQUEST_MICROS),
    requestsPerUser: agentPolicy.requestsPerUserPerDay,
  });
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

/** Internal service. Call only after authentication and owner-scoped candidate loading.
 * namespace exists for isolated database tests; it must never come from client input.
 * Micros are millionths of USD; reservation must cover the provider's maximum charge.
 */
export class AgentLedger {
  constructor(private readonly db: PrismaClient, private readonly policy: BudgetPolicy, private readonly namespace = 'agents-v1') {
    policySchema.parse(policy);
  }

  private async atomic<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(work, { isolationLevel: 'Serializable', timeout: 15_000 }); }
      catch (error) {
        // Retry only DB conflicts, never provider requests or unknown transport failures.
        if (attempt >= 4 || !(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2034', 'P2002'].includes(error.code)) throw error;
        await new Promise(resolve => setTimeout(resolve, 15 * (attempt + 1)));
      }
    }
  }

  async reserve(userId: string, key: string, request: unknown) {
    z.string().min(8).max(100).parse(key);
    const input = agentRequestSchema.parse(request);
    const fingerprint = digest(canonical(input));
    const day = new Date().toISOString().slice(0, 10);
    const globalScope = `${this.namespace}:global`;
    const userScope = `${this.namespace}:user:${digest(userId)}`;
    return this.atomic(async tx => {
      const existing = await tx.agentRequest.findUnique({ where: { userId_key: { userId, key } } });
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new Error('Request key was already used for different input.');
        return { request: existing, reused: true };
      }
      for (const scope of [globalScope, userScope]) {
        await tx.agentBudget.upsert({ where: { scope_day: { scope, day } }, create: { scope, day }, update: {} });
      }
      const global = await tx.agentBudget.findUniqueOrThrow({ where: { scope_day: { scope: globalScope, day } } });
      const user = await tx.agentBudget.findUniqueOrThrow({ where: { scope_day: { scope: userScope, day } } });
      if (user.requests >= this.policy.requestsPerUser) throw new Error('Daily generation allowance reached.');
      if (global.heldMicros + global.spentMicros + this.policy.maxRequestMicros > this.policy.dailyCapMicros) throw new Error('Daily AI budget reached.');
      for (const scope of [globalScope, userScope]) {
        await tx.agentBudget.update({ where: { scope_day: { scope, day } }, data: { requests: { increment: 1 }, heldMicros: { increment: this.policy.maxRequestMicros } } });
      }
      const record = await tx.agentRequest.create({ data: {
        userId, key, fingerprint, agent: input.agent, day, globalScope, userScope,
        reservedMicros: this.policy.maxRequestMicros,
      } });
      return { request: record, reused: false };
    });
  }

  async claim(userId: string, id: string) {
    const changed = await this.db.agentRequest.updateMany({ where: { id, userId, state: 'reserved', day: new Date().toISOString().slice(0, 10) }, data: { state: 'dispatched' } });
    return changed.count === 1; // Only this caller may send the provider request.
  }

  async markUncertain(userId: string, id: string) {
    // Keep the entire reservation: a timeout does not prove the provider charged nothing.
    await this.db.agentRequest.updateMany({ where: { id, userId, state: 'dispatched' }, data: { state: 'uncertain' } });
  }

  async settle(userId: string, id: string, outcome: {
    state: 'succeeded' | 'failed'; actualMicros: number; inputTokens: number; outputTokens: number;
    result?: Prisma.InputJsonValue;
  }) {
    z.object({ state: z.enum(['succeeded', 'failed']), actualMicros: z.number().int().min(0).max(1_000_000_000),
      inputTokens: z.number().int().min(0).max(10_000_000), outputTokens: z.number().int().min(0).max(10_000_000) }).parse(outcome);
    return this.atomic(async tx => {
      const record = await tx.agentRequest.findFirstOrThrow({ where: { id, userId } });
      if (['succeeded', 'failed'].includes(record.state)) return record;
      if (!['dispatched', 'uncertain'].includes(record.state)) throw new Error('Request has not been dispatched.');
      for (const scope of [record.globalScope, record.userScope]) {
        await tx.agentBudget.update({ where: { scope_day: { scope, day: record.day } }, data: {
          heldMicros: { decrement: record.reservedMicros }, spentMicros: { increment: outcome.actualMicros },
        } });
      }
      // Record overruns honestly. Future reservations fail closed when the daily cap is exceeded.
      return tx.agentRequest.update({ where: { id }, data: outcome });
    });
  }
}
