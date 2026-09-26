import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { garmentReference, garmentRegion } from '../../src/server/agents/garment-crop';
import { shoppingItem, type DetectedItem } from '../../src/lib/discovery';
import { parseProductEvidence } from '../../src/server/agents/product-evidence';
import { rankRisingFits, type TrendObservation } from '../../src/lib/viral-discovery';

test('garment crops isolate target pixels and safely fall back for old or invalid detections', async () => {
  const image = await sharp({
    create: { width: 200, height: 100, channels: 3, background: '#ff0000' },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 100, height: 100, channels: 3, background: '#0000ff' },
        })
          .png()
          .toBuffer(),
        left: 100,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
  const crop = await garmentReference(image, { left: 0.6, top: 0, right: 1, bottom: 1 });
  const { data, info } = await sharp(crop).raw().toBuffer({ resolveWithObject: true });
  expect(info.width).toBeLessThan(100);
  expect(data[2]).toBeGreaterThan(240);
  expect(data[0]).toBeLessThan(10);
  expect((await sharp(await garmentReference(image, null)).metadata()).width).toBe(200);
  for (const bounds of [
    { left: 0.8, top: 0, right: 0.1, bottom: 1 },
    { left: NaN, top: 0, right: 1, bottom: 1 },
    { left: -1, top: 0, right: 1, bottom: 1 },
    { left: 0, top: 0, right: 0.001, bottom: 1 },
  ])
    expect(garmentRegion(bounds, 200, 100)).toBeNull();
  const item = {
    name: 'shirt',
    category: 'tops',
    color: '#0000ff',
    description: 'Blue shirt',
    visibleBrand: null,
    uncertainty: '',
    bounds: { left: 0.6, top: 0, right: 1, bottom: 1 },
  } satisfies DetectedItem;
  expect(shoppingItem(item, 'Find the red jacket').bounds).toBeNull();
});

test('retailer social photo fallback does not invent identity, accept unrelated pages, or expose unsafe URLs', () => {
  const url = 'https://shop.example.com/products/shirt';
  const page = (tags: string) => `<html><head>${tags}</head><body></body></html>`;
  const photo =
    '<meta content="https://cdn.example.com/shirt.jpg?w=800&amp;h=800" property="og:image">';
  const result = parseProductEvidence(page(photo), url);
  expect(result.imageUrl).toBe('https://cdn.example.com/shirt.jpg?w=800&h=800');
  expect(result.availability).toBe('unknown');
  expect(result.modelCode).toBeUndefined();
  expect(result.brand).toBeUndefined();
  expect(result.price).toBeUndefined();
  expect(
    parseProductEvidence(page(photo), 'https://shop.example.com/collections/shirts').imageUrl,
  ).toBeUndefined();
  expect(
    parseProductEvidence(page(photo + '<meta property="og:url" content="/products/other">'), url)
      .imageUrl,
  ).toBeUndefined();
  expect(
    parseProductEvidence(page('<meta property="og:image" content="https://127.0.0.1/image">'), url)
      .imageUrl,
  ).toBeUndefined();
  expect(parseProductEvidence(page(`<!-- ${photo} -->`), url).imageUrl).toBeUndefined();
  expect(
    parseProductEvidence(page(photo) + `<body>${photo}</body>`, url).modelCode,
  ).toBeUndefined();
  expect(
    parseProductEvidence(
      page(
        photo +
          '<script type="application/ld+json">{"@type":"Product","name":"Other","url":"/products/other"}</script>',
      ),
      url,
    ).imageUrl,
  ).toBeUndefined();
  expect(
    parseProductEvidence(
      page(photo + '<meta property="og:image" content="https://cdn.example.com/other.jpg">'),
      url,
    ).imageUrl,
  ).toBeUndefined();
});

const now = new Date('2026-09-26T12:00:00.000Z');
function observations(): TrendObservation[] {
  return [100, 200, 300, 400, 4000].flatMap((added, index) => {
    const base = {
      provider: 'licensed-test-fixture',
      platform: 'youtube' as const,
      metricVersion: 'views-v1',
      cohort: 'US-short-1day',
      postId: `p${index}`,
      creatorId: `c${index}`,
      contentKey: `fit${index}`,
      sourceUrl: `https://www.youtube.com/watch?v=p${index}`,
      publishedAt: '2026-09-26T00:00:00.000Z',
      outfitRelevant: true,
    };
    return [
      { ...base, observedAt: '2026-09-26T08:00:00.000Z', views: 10000 },
      { ...base, observedAt: '2026-09-26T12:00:00.000Z', views: 10000 + added },
    ];
  });
}
test('rising discovery uses measured velocity and same-platform cohorts, not lifetime views', () => {
  const input = observations();
  input[0].views = 1_000_000;
  input[1].views = 1_000_100;
  const ranked = rankRisingFits(input, now);
  expect(ranked).toHaveLength(1);
  expect(ranked[0]).toMatchObject({
    observation: { postId: 'p4' },
    viewsAdded: 4000,
    viewsPerHour: 1000,
    measuredHours: 4,
    cohortPercentile: 1,
  });
  expect(
    rankRisingFits(
      input.filter((_, i) => i % 2),
      now,
    ),
  ).toEqual([]);
  expect(
    rankRisingFits(
      input.map((v, i) => ({ ...v, metricVersion: i % 2 ? 'new-counter' : 'old-counter' })),
      now,
    ),
  ).toEqual([]);
});
test('rising discovery rejects stale, reset, unrelated, future, duplicate and insufficient evidence', () => {
  const input = observations();
  expect(rankRisingFits(input, new Date('2026-09-27T00:00:00.000Z'))).toEqual([]);
  expect(rankRisingFits(input, new Date('2026-09-26T11:00:00.000Z'))).toEqual([]);
  expect(
    rankRisingFits(
      input.map((v) => ({ ...v, outfitRelevant: false })),
      now,
    ),
  ).toEqual([]);
  expect(
    rankRisingFits(
      input.map((v) => ({ ...v, sourceUrl: 'https://unrelated.example/post' })),
      now,
    ),
  ).toEqual([]);
  expect(
    rankRisingFits(
      input.map((v) => ({ ...v, contentKey: 'one-reposted-fit' })),
      now,
    ),
  ).toEqual([]);
  expect(
    rankRisingFits(
      input.map((v) => ({ ...v, creatorId: 'one-creator' })),
      now,
    ),
  ).toEqual([]);
  const reset = input.map((v) => ({ ...v }));
  reset[9].views = 2;
  expect(rankRisingFits(reset, now)).toEqual([]);
  expect(rankRisingFits(input.slice(0, 8), now)).toEqual([]);
});
