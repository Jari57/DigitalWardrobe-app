import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadEnvConfig } from '@next/env';
import { deriveAgentMemory } from '../../src/server/agents/memory';
import { qualityStylist, qualityCreator } from '../../src/server/agents/quality';
import {
  verifiedIdentityEvidence,
  reviewProductPhotos,
} from '../../src/server/agents/shopping-vision';
import { parseProductEvidence } from '../../src/server/agents/product-evidence';
import { fetchProductPhoto } from '../../src/server/agents/product-photo';
import { discoveryRequestKey } from '../../src/server/agents/discovery-key';
import { AgentLedger } from '../../src/server/agents/ledger';
import { reconcileCompleted } from '../../src/server/agents/recovery';
loadEnvConfig(process.cwd());
const item = {
  name: 'White shoe',
  category: 'shoes' as const,
  color: '#ffffff',
  description: 'White low-top shoe',
  visibleBrand: 'Example',
  uncertainty: '',
  readableText: ['AB1234'],
  visibleModelCode: 'AB1234',
};

test('private memory learns only explicit feedback, respects recency and separates cache versions', () => {
  const record = (reason: string, remember = true) => ({
    feedback: 'not-helpful',
    feedbackDetails: { reason, remember },
    result: { garmentIds: ['top', 'bottom'] },
  });
  const memory = deriveAgentMemory('stylist', [
    record('too-casual'),
    record('too-formal'),
    record('bad-pairing'),
    record('too-wordy'),
    record('wrong-weather', false),
  ]);
  expect(memory.rules.join(' ')).toContain('polished');
  expect(memory.rules.join(' ')).not.toContain('relaxed');
  expect(memory.rules.join(' ')).not.toContain('captions');
  expect(memory.avoidCombinations).toEqual([['bottom', 'top']]);
  expect(deriveAgentMemory('stylist', [record('bad-pairing', false)]).version).toBe('none');
  expect(
    deriveAgentMemory('creator', [{ feedback: 'helpful', feedbackDetails: null, result: {} }])
      .feedbackCount,
  ).toBe(0);
  const input = { agent: 'detect', imageId: 'photo' };
  expect(discoveryRequestKey(input, '2026-09-20', memory.version)).not.toBe(
    discoveryRequestKey(input, '2026-09-20'),
  );
});
test('rejected combinations change future selection but explicit locks remain authoritative', () => {
  const candidates = [
    { id: 'top', category: 'tops' },
    { id: 'bottom', category: 'bottoms' },
    { id: 'shoe', category: 'shoes' },
  ];
  const proposal = {
    garmentIds: ['top', 'bottom', 'shoe'],
    explanation: 'An outfit.',
    limitations: [],
  };
  expect(qualityStylist(proposal, candidates, [], [['top', 'bottom']]).garmentIds).not.toContain(
    'bottom',
  );
  expect(
    qualityStylist(proposal, candidates, ['top', 'bottom'], [['top', 'bottom']]).garmentIds,
  ).toEqual(expect.arrayContaining(['top', 'bottom']));
});
test('product identity needs matching code, brand and consistent visuals; unknown images spend nothing', async () => {
  const listing = {
    title: 'Shoe',
    url: 'https://shop.example/products/shoe',
    retailer: 'shop.example',
    reason: 'Candidate',
    match: 'possible-exact' as const,
    evidence: {
      sourceUrl: 'https://shop.example/products/shoe',
      checkedAt: new Date().toISOString(),
      availability: 'unknown' as const,
      note: 'Unknown',
      modelCode: 'AB1234',
      brand: 'Example',
    },
    visualReview: { status: 'consistent' as const, note: 'Visible details agree.' },
  };
  expect(verifiedIdentityEvidence(item, listing)).toBe('matching-code-and-visuals');
  expect(verifiedIdentityEvidence({ ...item, visibleModelCode: null }, listing)).toBe('unverified');
  expect(
    verifiedIdentityEvidence(item, {
      ...listing,
      evidence: { ...listing.evidence, modelCode: 'AB1235' },
    }),
  ).toBe('unverified');
  expect(
    verifiedIdentityEvidence(item, {
      ...listing,
      visualReview: { status: 'similar', note: 'Different sole' },
    }),
  ).toBe('unverified');
  const result = await reviewProductPhotos(item, [listing]);
  expect(result.generationCount).toBe(0);
  expect(result.cost).toBe(0);
  expect(result.listings[0].visualReview?.status).toBe('not-reviewed');
});
test('retailer image/code metadata stays tied to its product and remote photos reject private destinations', async () => {
  const url = 'https://shop.example/products/shoe';
  const product = {
    '@type': 'Product',
    url,
    name: 'White shoe',
    sku: 'AB1234',
    brand: { name: 'Example' },
    color: 'White',
    image: 'https://images.example/shoe.jpg',
    offers: { '@type': 'Offer', price: '40', priceCurrency: 'USD' },
  };
  const evidence = parseProductEvidence(
    '<script type="application/ld+json">' + JSON.stringify(product) + '</script>',
    url,
  );
  expect(evidence).toMatchObject({
    modelCode: 'AB1234',
    brand: 'Example',
    colorName: 'White',
    imageUrl: 'https://images.example/shoe.jpg',
  });
  expect(
    parseProductEvidence(
      '<script type="application/ld+json">' +
        JSON.stringify({ ...product, url: 'https://shop.example/products/other' }) +
        '</script>',
      url,
    ).imageUrl,
  ).toBeUndefined();
  await expect(fetchProductPhoto('https://127.0.0.1/private')).rejects.toThrow();
});
test('Creator drops unsupported material and promotional claims without inventing replacement facts', () => {
  const garments = [{ name: 'White tee', category: 'tops', color: '#ffffff' }];
  expect(
    qualityCreator({ caption: 'My luxury silk look', filmingSteps: ['Show the outfit.'] }, garments)
      .caption,
  ).not.toContain('silk');
  expect(
    qualityCreator(
      { caption: 'Sponsored by https://example.com', filmingSteps: ['Show the outfit.'] },
      garments,
    ).caption,
  ).not.toContain('Sponsored');
  expect(
    qualityCreator(
      { caption: 'A white tee kind of day', filmingSteps: ['Show the outfit.'] },
      garments,
    ).caption,
  ).toBe('A white tee kind of day');
});
test('third-stage shopping cost remains held until all three receipts are available', async () => {
  const db = new PrismaClient(),
    namespace = 'qa-learning-' + randomBytes(7).toString('hex');
  const user = await db.user.create({
    data: { username: namespace, passwordHash: 'disabled', recoveryHash: 'disabled' },
  });
  try {
    const ledger = new AgentLedger(
      db,
      { dailyCapMicros: 100, maxRequestMicros: 10, requestsPerUser: 10 },
      namespace,
    );
    const record = (
      await ledger.reserve(user.id, 'visual-three', {
        agent: 'shop',
        detectionId: 'scan',
        itemIndex: 0,
        country: 'US',
      })
    ).request;
    await ledger.claim(user.id, record.id);
    await db.agentRequest.update({
      where: { id: record.id },
      data: {
        state: 'uncertain',
        result: { generationCount: 3, listings: [] },
        generations: {
          create: [
            { id: namespace + '1', costMicros: 1 },
            { id: namespace + '2', costMicros: 2 },
          ],
        },
      },
    });
    expect(await reconcileCompleted(db, user.id, async () => 1)).toMatchObject({
      resolved: 0,
      unresolved: 1,
    });
    await db.agentGeneration.create({
      data: { id: namespace + '3', requestId: record.id, costMicros: 3 },
    });
    expect(await reconcileCompleted(db, user.id, async () => 1)).toMatchObject({
      resolved: 1,
      unresolved: 0,
    });
    expect(
      (await db.agentRequest.findUniqueOrThrow({ where: { id: record.id } })).actualMicros,
    ).toBe(6);
  } finally {
    await db.user.delete({ where: { id: user.id } });
    await db.agentBudget.deleteMany({ where: { scope: { startsWith: namespace } } });
    await db.$disconnect();
  }
});
test('feedback memory is owner-scoped, reviewable and resettable without any provider request', async ({
  page,
  context,
  browser,
}) => {
  const db = new PrismaClient(),
    password = randomBytes(20).toString('hex'),
    username = 'qa_' + randomBytes(7).toString('hex');
  const headers = { Origin: 'http://localhost:3100' };
  expect(
    (
      await context.request.post('/api/auth', {
        headers,
        data: { action: 'signup', username, password },
      })
    ).status(),
  ).toBe(201);
  const user = await db.user.findUniqueOrThrow({ where: { username } });
  try {
    const record = await db.agentRequest.create({
      data: {
        userId: user.id,
        key: 'learning-fixture',
        fingerprint: 'test',
        agent: 'stylist',
        state: 'succeeded',
        day: new Date().toISOString().slice(0, 10),
        globalScope: 'qa',
        userScope: 'qa',
        reservedMicros: 0,
        actualMicros: 0,
        result: { garmentIds: ['top', 'bottom'], explanation: 'Test', limitations: [] },
      },
    });
    expect(
      (
        await context.request.post('/api/agent-feedback', {
          headers,
          data: { id: record.id, feedback: 'not-helpful', reason: 'too-formal', remember: true },
        })
      ).status(),
    ).toBe(200);
    const memory = await (await context.request.get('/api/agent-memory')).json();
    expect(memory.agents.stylist.rules.join(' ')).toContain('relaxed');
    expect(memory.agents.creator.feedbackCount).toBe(0);
    const outside = await browser.newContext();
    try {
      expect((await outside.request.get('http://localhost:3100/api/agent-memory')).status()).toBe(
        401,
      );
      expect(
        (
          await outside.request.post('http://localhost:3100/api/agent-feedback', {
            headers,
            data: { id: record.id, feedback: 'helpful', remember: true },
          })
        ).status(),
      ).toBe(401);
      const strangerName = 'qa_' + randomBytes(7).toString('hex');
      expect(
        (
          await outside.request.post('http://localhost:3100/api/auth', {
            headers,
            data: { action: 'signup', username: strangerName, password },
          })
        ).status(),
      ).toBe(201);
      try {
        expect(
          (
            await outside.request.post('http://localhost:3100/api/agent-feedback', {
              headers,
              data: { id: record.id, feedback: 'helpful', remember: true },
            })
          ).status(),
        ).toBe(404);
        expect(
          (await (await outside.request.get('http://localhost:3100/api/agent-memory')).json())
            .agents.stylist.feedbackCount,
        ).toBe(0);
        expect(
          (
            await outside.request.delete('http://localhost:3100/api/agent-memory', {
              headers,
              data: {},
            })
          ).status(),
        ).toBe(200);
        expect(
          (await (await context.request.get('/api/agent-memory')).json()).agents.stylist
            .feedbackCount,
        ).toBe(1);
      } finally {
        await db.user.deleteMany({ where: { username: strangerName } });
      }
    } finally {
      await outside.close();
    }
    expect(
      (
        await context.request.post('/api/agent-feedback', {
          headers,
          data: { id: record.id, feedback: 'not-helpful', reason: 'too-salesy', remember: true },
        })
      ).status(),
    ).toBe(400);
    await page.goto('/');
    await page.getByRole('button', { name: 'Account settings', exact: true }).click();
    await page.getByText('What your agents remember', { exact: true }).click();
    await page.getByRole('button', { name: 'Review learned preferences', exact: true }).click();
    await expect(page.getByText('1 remembered ratings', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reset stylist preferences', exact: true }).click();
    await expect(
      page.getByText(
        'Learned preferences reset. Saved photos, outfits and ratings are unchanged.',
        { exact: true },
      ),
    ).toBeVisible();
    expect(
      (await (await context.request.get('/api/agent-memory')).json()).agents.stylist.version,
    ).toBe('none');
    expect((await db.agentRequest.findUniqueOrThrow({ where: { id: record.id } })).feedback).toBe(
      'not-helpful',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: '../agent-memory-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Close dialog' }).click();
    const scan = await db.agentRequest.create({
      data: {
        userId: user.id,
        key: 'feedback-ui-fixture',
        fingerprint: 'test',
        agent: 'detect',
        state: 'succeeded',
        day: new Date().toISOString().slice(0, 10),
        globalScope: 'qa',
        userScope: 'qa',
        reservedMicros: 0,
        actualMicros: 0,
        result: { items: [], note: 'No clothes', imageUrl: '/api/images/test-missing' },
      },
    });
    await page.reload();
    await page.getByLabel('Recent scans').selectOption(scan.id);
    await page.getByText('Help this agent improve for you', { exact: true }).click();
    await page.getByLabel('What should change?', { exact: true }).selectOption('missed-piece');
    await page.getByRole('button', { name: 'Save agent feedback', exact: true }).click();
    await expect(
      page.getByText('Saved. Future suggestions can use this feedback.', { exact: true }),
    ).toBeVisible();
    expect(
      (await (await context.request.get('/api/agent-memory')).json()).agents.detect.rules.join(' '),
    ).toContain('visible pieces');
    expect(await db.agentGeneration.count({ where: { requestId: scan.id } })).toBe(0);
    await page.screenshot({ path: '../agent-feedback-mobile.png', fullPage: true });
  } finally {
    await db.user.deleteMany({ where: { id: user.id } });
    await db.$disconnect();
  }
});

test('Creator recognizes known brand facts without inventing unprovided labels', () => {
  const draft = { caption: 'My Gucci look', filmingSteps: ['Show the outfit.'] };
  expect(
    qualityCreator(draft, [{ name: 'Tee', category: 'tops', color: '#ffffff' }]).caption,
  ).not.toContain('Gucci');
  expect(
    qualityCreator(draft, [{ name: 'Tee', brand: 'Gucci', category: 'tops', color: '#ffffff' }])
      .caption,
  ).toBe('My Gucci look');
});
