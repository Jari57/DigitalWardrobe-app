import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadEnvConfig } from '@next/env';
import { randomBytes } from 'node:crypto';
import { AgentLedger, configuredAgentBudget } from '../../src/server/agents/ledger';

loadEnvConfig(process.cwd());
const request = { agent: 'stylist', candidateIds: [], lockedIds: [], occasion: 'Test', aesthetic: '' };

test('ledger atomically deduplicates, limits budget, and retains uncertain charges', async () => {
  const db = new PrismaClient();
  const namespace = `qa-ledger-${randomBytes(8).toString('hex')}`;
  const user = await db.user.create({ data: { username: namespace.replaceAll('-', '_'), passwordHash: 'test-only-no-login', recoveryHash: 'test-only-no-login' } });
  try {
    const ledger = new AgentLedger(db, { dailyCapMicros: 20, maxRequestMicros: 10, requestsPerUser: 10 }, namespace);
    const duplicates = await Promise.all(Array.from({ length: 4 }, () => ledger.reserve(user.id, 'same-key-123', request)));
    expect(duplicates.filter(r => !r.reused)).toHaveLength(1);
    const id = duplicates[0].request.id;
    expect(new Set(duplicates.map(r => r.request.id)).size).toBe(1);
    await expect(ledger.reserve(user.id, 'same-key-123', { ...request, occasion: 'Different' })).rejects.toThrow('different input');
    const claims = await Promise.all([ledger.claim(user.id, id), ledger.claim(user.id, id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    await ledger.markUncertain(user.id, id);
    expect((await db.agentBudget.findFirstOrThrow({ where: { scope: `${namespace}:global` } })).heldMicros).toBe(10);
    const competitors = await Promise.allSettled(Array.from({ length: 3 }, (_, i) => ledger.reserve(user.id, `another-${i}`, request)));
    expect(competitors.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    await expect(ledger.reserve(user.id, 'exhausted-key', request)).rejects.toThrow('budget');
    const outcome = { state: 'succeeded' as const, actualMicros: 3, inputTokens: 10, outputTokens: 5, result: { explanation: 'Test only' } };
    await Promise.all([ledger.settle(user.id, id, outcome), ledger.settle(user.id, id, outcome)]);
    const budget = await db.agentBudget.findFirstOrThrow({ where: { scope: `${namespace}:global` } });
    expect(budget.spentMicros).toBe(3);
    expect(budget.heldMicros).toBe(10);
    expect(budget.requests).toBe(2);
    expect(await ledger.claim('other-user', id)).toBe(false);
    await expect(ledger.settle('other-user', id, outcome)).rejects.toThrow();
    // Unsent reservations from yesterday cannot consume yesterday's cap today.
    const pending = competitors.find(r => r.status === 'fulfilled');
    if (pending?.status === 'fulfilled') {
      await db.agentRequest.update({ where: { id: pending.value.request.id }, data: { day: '2000-01-01' } });
      expect(await ledger.claim(user.id, pending.value.request.id)).toBe(false);
    }
    const limited = new AgentLedger(db, { dailyCapMicros: 100, maxRequestMicros: 10, requestsPerUser: 1 }, namespace + '-user-limit');
    await limited.reserve(user.id, 'user-limit-first', request);
    await expect(limited.reserve(user.id, 'user-limit-second', request)).rejects.toThrow('allowance');
  } finally {
    await db.user.delete({ where: { id: user.id } });
    await db.agentBudget.deleteMany({ where: { scope: { startsWith: namespace } } });
    await db.$disconnect();
  }
});

test('AI is disabled without explicit budget configuration', () => {
  const previous = process.env.AI_ENABLED;
  process.env.AI_ENABLED = 'false';
  try { expect(() => configuredAgentBudget()).toThrow('not enabled'); }
  finally { if (previous === undefined) delete process.env.AI_ENABLED; else process.env.AI_ENABLED = previous; }
});
