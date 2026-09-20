import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { loadEnvConfig } from '@next/env';
import { PrismaClient } from '@prisma/client';
import { AgentLedger } from '../../src/server/agents/ledger';

test('preferences, draft ownership, minimal measurement and deletion work end to end', async ({
  request,
  playwright,
}) => {
  loadEnvConfig(process.cwd());
  const db = new PrismaClient();
  const ids: string[] = [];
  const other = await playwright.request.newContext({ baseURL: 'http://localhost:3100' });
  const headers = { Origin: 'http://localhost:3100' };
  const password = randomBytes(20).toString('hex');
  try {
    for (const client of [request, other]) {
      const response = await client.post('/api/auth', {
        headers,
        data: { action: 'signup', username: `qa_exp_${randomBytes(8).toString('hex')}`, password },
      });
      expect(response.status()).toBe(201);
      ids.push((await response.json()).user.id);
    }
    const preferences = { region: 'GB', currency: 'GBP', maxPrice: 80, sizes: 'Tops M' };
    expect(
      (
        await request.patch('/api/experience', {
          headers,
          data: { kind: 'preferences', preferences },
        })
      ).status(),
    ).toBe(200);
    expect((await (await request.get('/api/experience')).json()).preferences).toEqual(preferences);
    expect((await (await other.get('/api/experience')).json()).preferences.maxPrice).toBeNull();
    expect(
      (
        await request.patch('/api/experience', {
          headers,
          data: { kind: 'preferences', preferences: { ...preferences, maxPrice: -1 } },
        })
      ).status(),
    ).toBe(400);
    const image = await db.image.create({
      data: { userId: ids[0], mimeType: 'image/png', width: 1, height: 1, data: Buffer.from([1]) },
    });
    const garment = await db.garment.create({
      data: {
        userId: ids[0],
        imageId: image.id,
        name: 'Test top',
        category: 'tops',
        color: '#222222',
      },
    });
    const pieces = [{ garmentId: garment.id, x: 10, y: 20, scale: 1, zIndex: 0 }];
    expect(
      (
        await request.patch('/api/experience', { headers, data: { kind: 'draft', pieces } })
      ).status(),
    ).toBe(200);
    expect(
      (await other.patch('/api/experience', { headers, data: { kind: 'draft', pieces } })).status(),
    ).toBe(404);
    expect((await (await request.get('/api/experience')).json()).draft).toEqual(pieces);
    for (let i = 0; i < 2; i++)
      expect(
        (await request.post('/api/journey', { headers, data: { event: 'visit' } })).status(),
      ).toBe(200);
    expect(await db.journeyMetric.count({ where: { userId: ids[0] } })).toBe(1);
    expect(
      (
        await request.post('/api/journey', { headers, data: { event: 'visit', photo: 'private' } })
      ).status(),
    ).toBe(400);
    expect((await request.delete('/api/account', { headers, data: { password } })).status()).toBe(
      200,
    );
    expect(await db.userExperience.count({ where: { userId: ids[0] } })).toBe(0);
    expect(await db.journeyMetric.count({ where: { userId: ids[0] } })).toBe(0);
    expect((await request.get('/api/experience')).status()).toBe(401);
  } finally {
    await db.garment.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await other.dispose();
    await db.$disconnect();
  }
});

test('only confirmed zero-cost rejections can retry and concurrent retries cannot duplicate dispatch', async () => {
  loadEnvConfig(process.cwd());
  const db = new PrismaClient();
  const namespace = `qa_retry_${randomBytes(8).toString('hex')}`;
  const user = await db.user.create({
    data: { username: namespace, passwordHash: 'no-login', recoveryHash: 'no-login' },
  });
  try {
    const ledger = new AgentLedger(
      db,
      { dailyCapMicros: 100, maxRequestMicros: 10, requestsPerUser: 10 },
      namespace,
    );
    const record = (
      await ledger.reserve(user.id, 'rejected-test-key', { agent: 'detect', imageId: 'photo' })
    ).request;
    await ledger.claim(user.id, record.id);
    await ledger.markUncertain(user.id, record.id);
    expect(await ledger.retryRejected(user.id, record.id)).toBe(false);
    await ledger.settle(user.id, record.id, {
      state: 'failed',
      actualMicros: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
    const retries = await Promise.all([
      ledger.retryRejected(user.id, record.id),
      ledger.retryRejected(user.id, record.id),
    ]);
    expect(retries.filter(Boolean)).toHaveLength(1);
    expect(
      (
        await Promise.all([ledger.claim(user.id, record.id), ledger.claim(user.id, record.id)])
      ).filter(Boolean),
    ).toHaveLength(1);
    await db.agentGeneration.create({
      data: { id: namespace, requestId: record.id, costMicros: 0 },
    });
    await ledger.settle(user.id, record.id, {
      state: 'failed',
      actualMicros: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(await ledger.retryRejected(user.id, record.id)).toBe(false);
  } finally {
    await db.user.delete({ where: { id: user.id } });
    await db.agentBudget.deleteMany({ where: { scope: { startsWith: namespace + ':' } } });
    await db.$disconnect();
  }
});

test('preferences stay optional and a selected screenshot survives tab changes', async ({
  page,
}) => {
  await page.route('**/api/session', (r) => r.fulfill({ json: { user: null } }));
  await page.goto('/');
  const sharp = (await import('sharp')).default;
  const buffer = await sharp({
    create: { width: 100, height: 100, channels: 3, background: '#777' },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel('Clothing or outfit photo', { exact: true })
    .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer });
  await expect(page.getByAltText('Your selected screenshot')).toBeVisible();
  await page.getByRole('button', { name: 'Closet', exact: true }).click();
  await page.getByRole('button', { name: 'Spotter', exact: true }).click();
  await expect(page.getByAltText('Your selected screenshot')).toBeVisible();
});
