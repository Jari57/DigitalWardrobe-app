import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadEnvConfig } from '@next/env';
import { randomBytes } from 'node:crypto';
import { AgentLedger } from '../../src/server/agents/ledger';
import { reconcileCompleted } from '../../src/server/agents/recovery';
loadEnvConfig(process.cwd());
test('recovery settles complete receipts once and never releases partial-search holds', async () => {
  const db = new PrismaClient(),
    namespace = `qa-recovery-${randomBytes(8).toString('hex')}`;
  const user = await db.user.create({
    data: { username: namespace, passwordHash: 'disabled-test', recoveryHash: 'disabled-test' },
  });
  try {
    const ledger = new AgentLedger(
      db,
      { dailyCapMicros: 100, maxRequestMicros: 10, requestsPerUser: 10 },
      namespace,
    );
    const reserve = async (key: string, agent: 'capture' | 'shop') => {
      const input =
        agent === 'capture'
          ? { agent, imageId: 'test-image' }
          : { agent, detectionId: 'test-detection', itemIndex: 0, country: 'US' };
      const r = await ledger.reserve(user.id, key, input);
      await ledger.claim(user.id, r.request.id);
      return r.request.id;
    };
    const complete = await reserve('complete-test', 'capture');
    await db.agentRequest.update({
      where: { id: complete },
      data: {
        state: 'uncertain',
        result: { items: [], note: 'test' },
        generations: { create: { id: namespace + '-complete', costMicros: null } },
      },
    });
    const partial = await reserve('partial-test', 'shop');
    await db.agentRequest.update({
      where: { id: partial },
      data: {
        state: 'uncertain',
        generations: { create: { id: namespace + '-partial', costMicros: 2 } },
      },
    });
    expect(await reconcileCompleted(db, user.id, async () => 3)).toEqual({
      resolved: 1,
      unresolved: 1,
    });
    expect(
      await db.agentBudget.findUniqueOrThrow({
        where: {
          scope_day: { scope: namespace + ':global', day: new Date().toISOString().slice(0, 10) },
        },
      }),
    ).toMatchObject({ spentMicros: 3, heldMicros: 10 });
    expect(await reconcileCompleted(db, user.id, async () => 3)).toEqual({
      resolved: 0,
      unresolved: 1,
    });
    expect(await reconcileCompleted(db, 'not-owner', async () => 3)).toEqual({
      resolved: 0,
      unresolved: 0,
    });
  } finally {
    await db.user.delete({ where: { id: user.id } });
    await db.agentBudget.deleteMany({ where: { scope: { startsWith: namespace } } });
    await db.$disconnect();
  }
});
