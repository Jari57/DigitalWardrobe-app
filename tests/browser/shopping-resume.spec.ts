import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadEnvConfig } from '@next/env';
import { randomBytes } from 'node:crypto';
import { shoppingItem, shoppingRequestSchema } from '../../src/lib/discovery';
import { discoveryRequestKey } from '../../src/server/agents/discovery-key';
import { AgentLedger } from '../../src/server/agents/ledger';

const piece = {
  name: 'Blue shirt',
  description: 'Blue cotton shirt',
  category: 'tops' as const,
  color: '#446688',
  visibleBrand: 'Visible label',
  uncertainty: '',
};

test('edited descriptions are bounded, separately cached and never establish exact identity', () => {
  const base = { agent: 'shop', detectionId: 'scan', itemIndex: 0, country: 'US' };
  const input = shoppingRequestSchema.parse({ ...base, description: '  White linen shirt  ' });
  expect(input.description).toBe('White linen shirt');
  expect(discoveryRequestKey(input)).not.toBe(
    discoveryRequestKey(shoppingRequestSchema.parse(base)),
  );
  expect(discoveryRequestKey(input)).toBe(
    discoveryRequestKey(shoppingRequestSchema.parse({ ...base, description: 'White linen shirt' })),
  );
  expect(shoppingItem(piece, input.description).visibleBrand).toBeNull();
  expect(piece.visibleBrand).toBe('Visible label');
  expect(shoppingRequestSchema.safeParse({ ...base, description: 'a'.repeat(401) }).success).toBe(
    false,
  );
  expect(shoppingRequestSchema.safeParse({ ...base, description: '   ' }).success).toBe(false);
});

test('history and cached corrected searches are owner-scoped and do not reserve again', async ({
  request,
  playwright,
}) => {
  loadEnvConfig(process.cwd());
  const db = new PrismaClient();
  const namespace = `qa_resume_${randomBytes(8).toString('hex')}`;
  const ids: string[] = [];
  const other = await playwright.request.newContext({ baseURL: 'http://localhost:3100' });
  const headers = { Origin: 'http://localhost:3100' };
  try {
    for (const [index, client] of [request, other].entries()) {
      const response = await client.post('/api/auth', {
        headers,
        data: {
          action: 'signup',
          username: `${namespace}_${index}`,
          password: randomBytes(20).toString('hex'),
        },
      });
      expect(response.status()).toBe(201);
      ids.push((await response.json()).user.id);
    }
    const ledger = new AgentLedger(
      db,
      { dailyCapMicros: 100, maxRequestMicros: 10, requestsPerUser: 10 },
      namespace,
    );
    const detection = await ledger.reserve(ids[0], 'fixture-detection-key', {
      agent: 'detect',
      imageId: 'test-image',
    });
    await db.agentRequest.update({
      where: { id: detection.request.id },
      data: {
        state: 'succeeded',
        result: { imageUrl: '/icons/icon-192.png', items: [piece], note: 'Test scan' },
      },
    });
    const input = shoppingRequestSchema.parse({
      agent: 'shop',
      detectionId: detection.request.id,
      itemIndex: 0,
      country: 'GB',
      description: 'White linen shirt',
    });
    const cached = await ledger.reserve(ids[0], discoveryRequestKey(input), input);
    await db.agentRequest.update({
      where: { id: cached.request.id },
      data: {
        state: 'succeeded',
        result: {
          country: 'GB',
          searchedAt: '2026-09-12T12:00:00.000Z',
          listings: [],
          note: 'Fixture result',
        },
      },
    });
    const countBefore = await db.agentRequest.count({ where: { userId: ids[0] } });
    const response = await request.post('/api/discovery', { headers, data: input });
    expect(response.status()).toBe(200);
    expect((await response.json()).id).toBe(cached.request.id);
    const historyResponse = await request.get('/api/discovery');
    expect(historyResponse.headers()['cache-control']).toContain('no-store');
    const history = await historyResponse.json();
    expect(history.searches).toHaveLength(1);
    expect(history.searches[0].searchContext.description).toBe('White linen shirt');
    expect((await (await other.get('/api/discovery')).json()).searches).toEqual([]);
    expect((await other.post('/api/discovery', { headers, data: input })).status()).toBe(404);
    expect(
      (
        await request.post('/api/discovery', {
          headers,
          data: { ...input, description: 'a'.repeat(401) },
        })
      ).status(),
    ).toBe(400);
    expect(await db.agentRequest.count({ where: { userId: ids[0] } })).toBe(countBefore);
  } finally {
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.agentBudget.deleteMany({ where: { scope: { startsWith: namespace + ':' } } });
    await other.dispose();
    await db.$disconnect();
  }
});

test('corrected results reopen in their region without a POST and saved pieces lead to closet', async ({
  page,
}) => {
  let posts = 0;
  let results: object[] = [];
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { user: { id: 'fixture', username: 'fixture' } } }),
  );
  await page.route('**/api/wardrobe', (route) =>
    route.fulfill({ json: { garments: [], outfits: [], references: [] } }),
  );
  await page.route('**/api/garments', (route) =>
    route.fulfill({ json: { garment: { id: 'saved' } } }),
  );
  await page.route('**/api/discovery', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: {
          enabled: true,
          detections: [{ id: 'scan', imageUrl: '/icons/icon-192.png', items: [piece], note: '' }],
          searches: results,
        },
      });
    posts++;
    const body = route.request().postDataJSON();
    expect(body.description).toBe('White linen shirt');
    const result = {
      id: 'search',
      country: body.country,
      searchContext: {
        detectionId: body.detectionId,
        itemIndex: body.itemIndex,
        description: body.description,
      },
      searchedAt: '2026-09-12T12:00:00.000Z',
      listings: [],
      note: 'No supported listings.',
    };
    results = [result];
    return route.fulfill({ json: result });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Continue your latest scan/ }).click();
  await page.getByLabel('Shopping region').selectOption('GB');
  await page.getByText('Edit search details', { exact: true }).click();
  await page.getByLabel('Describe the piece to find').fill('White linen shirt');
  await page.locator('.search-details').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../shopping-edit-mobile.png' });
  await page.getByRole('button', { name: 'Search with these details' }).click();
  await expect(page.getByText('Searching for: White linen shirt')).toBeVisible();
  expect(posts).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: /Continue your latest scan/ }).click();
  await expect(page.getByLabel('Shopping region')).toHaveValue('GB');
  await expect(page.getByText('Searching for: White linen shirt')).toBeVisible();
  await expect(page.getByText('Saved results ·', { exact: false })).toBeVisible();
  expect(posts).toBe(1);
  await page.getByText('Edit search details', { exact: true }).click();
  await page.getByRole('button', { name: 'Use original details' }).click();
  await expect(page.getByText('Saved results ·', { exact: false })).toHaveCount(0);
  expect(posts).toBe(1);
  await page.getByRole('button', { name: 'I own this · save' }).click();
  await page.getByRole('button', { name: 'Save piece', exact: true }).click();
  await page.getByRole('button', { name: 'Open my closet' }).click();
  await expect(page.getByRole('button', { name: 'Closet', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(posts).toBe(1);
});
