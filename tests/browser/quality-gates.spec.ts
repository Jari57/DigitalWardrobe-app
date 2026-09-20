import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { loadEnvConfig } from '@next/env';
import { PrismaClient } from '@prisma/client';
import {
  qualityShoppingListings,
  storefrontRegion,
  canonicalProductUrl,
  conciseText,
  reviewShoppingResult,
  productCategory,
} from '../../src/lib/shopping-quality';
import { groundedListings, type ShoppingResult } from '../../src/lib/discovery';
import { AgentLedger } from '../../src/server/agents/ledger';
import { qualitySpotter, qualityStylist } from '../../src/server/agents/quality';

test('Spotter preserves useful matches but clears repeated, unavailable and wrong-category pairings', () => {
  const candidates = [
    { id: 'top', category: 'tops' },
    { id: 'shoe', category: 'shoes' },
  ];
  const result = qualitySpotter(
    {
      elements: [
        { description: 'Blue shirt', garmentId: 'shoe', explanation: 'Incorrect category' },
        { description: 'White shirt', garmentId: 'top', explanation: 'Useful substitute' },
        { description: 'Another shirt', garmentId: 'top', explanation: 'Duplicate' },
        { description: 'Black skirt', garmentId: 'invented', explanation: 'Unavailable' },
      ],
      limitations: [],
    },
    candidates,
  );
  expect(result.elements.map((e) => e.garmentId)).toEqual([null, 'top', null, null]);
});

test('Stylist preserves locks, removes conflicting proposals and labels incomplete outfits', () => {
  const candidates = [
    { id: 'top', category: 'tops' },
    { id: 'top2', category: 'tops' },
    { id: 'dress', category: 'dresses' },
  ];
  const proposal = {
    garmentIds: ['top2', 'dress', 'unknown'],
    explanation: 'Model explanation',
    limitations: [],
  };
  const result = qualityStylist(proposal, candidates, ['top']);
  expect(result.garmentIds).toEqual(['top']);
  expect(result.limitations.join(' ')).toContain('partial outfit');
  expect(qualityStylist(proposal, candidates, ['top', 'dress']).garmentIds).toEqual([
    'top',
    'dress',
  ]);
  expect(() => qualityStylist(proposal, candidates, ['not-owned'])).toThrow();
});

const listing = (
  url: string,
  extra: Partial<ShoppingResult['listings'][number]> = {},
): ShoppingResult['listings'][number] => ({
  title: 'Blue shirt',
  url,
  retailer: new URL(url).hostname,
  reason: 'Similar cut; identity unverified.',
  match: 'similar',
  ...extra,
});
for (const country of ['US', 'GB', 'CA', 'AU'])
  test(`storefront policy: ${country} handles local, conflicting and unknown signals`, () => {
    const locales = { US: 'us', GB: 'gb', CA: 'ca', AU: 'au' };
    for (const [region, locale] of Object.entries(locales)) {
      expect(storefrontRegion(`https://shop.example/en-${locale}/products/shirt`, country)).toBe(
        region === country ? 'matching' : 'conflicting',
      );
      expect(storefrontRegion(`https://shop.example/${locale}/products/shirt`, country)).toBe(
        region === country ? 'matching' : 'conflicting',
      );
    }
    expect(storefrontRegion('https://shop.example/products/shirt', country)).toBe('unknown');
    expect(storefrontRegion('https://shop.example/eu/en/products/shirt', country)).toBe(
      'conflicting',
    );
  });

test('language paths and product identifiers do not invent region evidence', () => {
  expect(storefrontRegion('https://shop.example/fr-ca/products/shirt', 'CA')).toBe('matching');
  expect(storefrontRegion('https://shop.example/fr/products/shirt', 'CA')).toBe('unknown');
  expect(storefrontRegion('https://shop.example/products/ca', 'US')).toBe('unknown');
  expect(storefrontRegion('https://etsy.com/il-en/listing/123', 'US')).toBe('conflicting');
  expect(storefrontRegion('https://shop.co.uk/products/shirt', 'US')).toBe('conflicting');
  expect(storefrontRegion('https://shop.com.au/products/shirt', 'AU')).toBe('matching');
});

test('shopping gates reject conflicting redirects, unknown pages, over-budget prices and wrong types', () => {
  const evidence = {
    availability: 'unknown' as const,
    checkedAt: new Date().toISOString(),
    sourceUrl: 'https://shop.example/products/shirt',
    productName: 'Blue shirt',
    note: 'Confirm variants.',
    price: 120,
    currency: 'USD',
  };
  const candidates = [
    listing('https://shop.example/products/shirt', { evidence }),
    listing('https://shop.example/products/redirect', {
      evidence: { ...evidence, sourceUrl: 'https://shop.example/en-gb/products/shirt', price: 20 },
    }),
    listing('https://unknown.example/item/a'),
    listing('https://shop.example/products/dress', { title: 'Blue dress' }),
    listing('https://shop.example/products/unknown-price'),
    listing('https://shop.example/products/cad-price', {
      evidence: {
        ...evidence,
        sourceUrl: 'https://shop.example/products/cad-price',
        currency: 'CAD',
      },
    }),
  ];
  const result = qualityShoppingListings(
    candidates,
    'US',
    { currency: 'USD', maxPrice: 80, sizes: 'M' },
    'tops',
  );
  expect(result.map((r) => r.url)).toEqual([
    'https://shop.example/products/cad-price',
    'https://shop.example/products/unknown-price',
  ]);
  expect(result[0].evidence?.availability).toBe('unknown');
  expect(productCategory('Dress shirt')).toBe('tops');
  expect(productCategory('Shirt dress')).toBe('dresses');
  expect(productCategory('Shirt jacket')).toBeUndefined();
});

test('duplicate tracking links collapse but distinct sizes and variants survive', () => {
  const a = 'https://www.shop.example/products/shirt?utm_source=search#details';
  const b = 'https://shop.example/products/shirt?gclid=123';
  expect(canonicalProductUrl(a)).toBe(canonicalProductUrl(b));
  const result = qualityShoppingListings(
    [listing(a), listing(b), listing('https://shop.example/products/shirt?variant=blue')],
    'US',
  );
  expect(result).toHaveLength(2);
});

test('identity claims require a source brand token and saved results are rechecked without generation', () => {
  const ranking = {
    listings: [{ sourceIndex: 0, reason: 'Visual candidate', match: 'possible-exact' as const }],
    note: '',
  };
  expect(
    groundedListings(
      ranking,
      [{ title: 'Blue shirt', url: 'https://shop.example/products/shirt' }],
      'Zara',
    )[0].match,
  ).toBe('similar');
  expect(
    groundedListings(
      ranking,
      [{ title: 'Zaracus shirt', url: 'https://shop.example/products/shirt' }],
      'Zara',
    )[0].match,
  ).toBe('similar');
  expect(
    groundedListings(
      ranking,
      [{ title: 'ZARA blue shirt', url: 'https://shop.example/products/shirt' }],
      'Zara',
    )[0].match,
  ).toBe('possible-exact');
  const old = {
    id: 'old',
    country: 'US',
    searchedAt: '2026-09-12T00:00:00Z',
    note: 'old',
    listings: [listing('https://shop.example/eu/en/products/shirt')],
  };
  const reviewed = reviewShoppingResult(old);
  expect(reviewed.listings).toEqual([]);
  expect(reviewed.id).toBe('old');
  expect(reviewed.searchedAt).toBe(old.searchedAt);
  expect(old.listings).toHaveLength(1);
  expect(conciseText('A useful explanation '.repeat(30), 80)).toMatch(/ …$|\S…$/);
  expect(conciseText('A useful explanation '.repeat(30), 80).length).toBeLessThanOrEqual(80);
});

test('failed single-stage output charges its known receipt; uncertain and partial shopping holds remain', async () => {
  loadEnvConfig(process.cwd());
  const db = new PrismaClient();
  const namespace = `qa_quality_${randomBytes(8).toString('hex')}`;
  const user = await db.user.create({
    data: { username: namespace, passwordHash: 'no-login', recoveryHash: 'no-login' },
  });
  try {
    const ledger = new AgentLedger(
      db,
      { dailyCapMicros: 1000, maxRequestMicros: 100, requestsPerUser: 10 },
      namespace,
    );
    for (const [agent, cost] of [
      ['detect', 7],
      ['detect', null],
      ['shop', 8],
    ] as const) {
      const input =
        agent === 'shop'
          ? { agent, detectionId: 'scan', itemIndex: 0, country: 'US' as const }
          : { agent, imageId: 'photo' };
      const record = (await ledger.reserve(user.id, `quality-${agent}-${cost}`, input)).request;
      await ledger.claim(user.id, record.id);
      await ledger.markUncertain(user.id, record.id);
      await db.agentGeneration.create({
        data: { id: `${namespace}-${agent}-${cost}`, requestId: record.id, costMicros: cost },
      });
      expect(await ledger.settleFailedSingleStage(user.id, record.id)).toBe(
        agent === 'detect' && cost !== null,
      );
      const saved = await db.agentRequest.findUniqueOrThrow({ where: { id: record.id } });
      expect(saved.state).toBe(agent === 'detect' && cost !== null ? 'failed' : 'uncertain');
      expect(await ledger.retryRejected(user.id, record.id)).toBe(false);
    }
    const budget = await db.agentBudget.findUniqueOrThrow({
      where: {
        scope_day: { scope: namespace + ':global', day: new Date().toISOString().slice(0, 10) },
      },
    });
    expect(budget.spentMicros).toBe(7);
    expect(budget.heldMicros).toBe(200);
  } finally {
    await db.user.delete({ where: { id: user.id } });
    await db.agentBudget.deleteMany({ where: { scope: { startsWith: namespace + ':' } } });
    await db.$disconnect();
  }
});

test('retailer model-code URLs survive unavailable metadata without admitting arbitrary HTML pages', () => {
  const candidates = [
    listing('https://www.adidas.com/us/samba-og-shoes/B75806.html'),
    listing('https://www.adidas.com/us/samba-og-shoes/B75807.html'),
    listing('https://www.adidas.com/us/samba'),
    listing('https://unverified.example/us/shoes/B75806.html'),
  ];
  expect(qualityShoppingListings(candidates, 'US').map((item) => item.url)).toEqual(
    candidates.slice(0, 2).map((item) => item.url),
  );
});
