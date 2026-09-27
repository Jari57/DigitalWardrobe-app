import { test, expect } from '@playwright/test';
import { mock } from 'node:test';
import sharp from 'sharp';
import { ToolLoopAgent } from 'ai';
import * as photos from '../../src/server/agents/product-photo';
import { reviewProductPhotos } from '../../src/server/agents/shopping-vision';
import { withAgentUsage } from '../../src/server/agents/usage';
import { db } from '../../src/server/db';
import type { DetectedItem, ShoppingResult } from '../../src/lib/discovery';

const item: DetectedItem = {
  name: 'Blue shirt',
  category: 'tops',
  color: '#0000ff',
  description: 'Blue shirt',
  visibleBrand: null,
  uncertainty: '',
  readableText: [],
  visibleModelCode: null,
};
const listings = (count = 8): ShoppingResult['listings'] =>
  Array.from({ length: count }, (_, index) => ({
    title: `Shirt ${index}`,
    url: `https://retailer.example/products/${index}`,
    retailer: 'retailer.example',
    reason: 'Relevant search result',
    match: 'similar',
    evidence: {
      availability: 'unknown',
      checkedAt: '2026-09-27T00:00:00Z',
      sourceUrl: `https://retailer.example/products/${index}`,
      note: '',
      imageUrl: `https://images.example/${index}.jpg`,
    },
  }));
const fixture = async () => ({
  data: await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: '#0000ff',
    },
  })
    .jpeg()
    .toBuffer(),
  mimeType: 'image/jpeg',
});

test.afterEach(() => mock.restoreAll());

test('broken retailer photos use bounded backups and preserve original source indices', async () => {
  const photo = await fixture();
  const attempts: number[] = [];
  mock.method(photos, 'fetchProductPhoto', async (url: string) => {
    const index = Number(new URL(url).pathname.match(/\d+/)![0]);
    attempts.push(index);
    if (index < 3) throw new Error('Expired image');
    return photo;
  });
  let generated = 0;
  mock.method(
    ToolLoopAgent.prototype,
    'generate',
    async (input: { messages: { content: { type: string; text?: string }[] }[] }) => {
      generated++;
      const labels = input.messages[0].content
        .filter((part) => part.type === 'text' && part.text?.includes('sourceIndex'))
        .map((part) => JSON.parse(part.text!).sourceIndex);
      expect(labels).toEqual([3, 4, 5]);
      return {
        providerMetadata: { gateway: { cost: '0.000250' } },
        totalUsage: { inputTokens: 50, outputTokens: 12 },
        output: {
          reviews: [
            { sourceIndex: 3, status: 'consistent', note: 'Color agrees' },
            { sourceIndex: 4, status: 'different', note: 'Wrong cut' },
            { sourceIndex: 5, status: 'similar', note: 'Similar cut' },
          ],
        },
      };
    },
  );
  const result = await reviewProductPhotos(item, listings(), photo);
  expect(attempts).toEqual([0, 1, 2, 3, 4, 5]);
  expect(generated).toBe(1);
  expect(result.listings.some((listing) => listing.title === 'Shirt 4')).toBe(false);
  expect(result.listings.find((listing) => listing.title === 'Shirt 3')?.visualReview?.status).toBe(
    'consistent',
  );
  expect(result.listings.every((listing) => listing.identityEvidence === 'unverified')).toBe(true);
  expect(result).toMatchObject({
    cost: 250,
    generationCount: 1,
    inputTokens: 50,
    outputTokens: 12,
  });
});

test('photo attempts stop at eight and no generation is charged when preparation cannot finish', async () => {
  const photo = await fixture();
  let attempts = 0;
  let generated = 0;
  mock.method(photos, 'fetchProductPhoto', async () => {
    attempts++;
    throw new Error('Unavailable');
  });
  mock.method(ToolLoopAgent.prototype, 'generate', async () => {
    generated++;
    throw new Error('Must not generate');
  });
  const result = await reviewProductPhotos(item, listings(10), photo);
  expect(attempts).toBe(8);
  expect(generated).toBe(0);
  expect(result).toMatchObject({ cost: 0, generationCount: 0 });
  expect(result.listings).toHaveLength(10);
  mock.method(photos, 'fetchProductPhoto', async () => photo);
  const invalid = await reviewProductPhotos(item, listings(), {
    data: new Uint8Array([1]),
    mimeType: 'image/jpeg',
  });
  expect(invalid).toMatchObject({ cost: 0, generationCount: 0 });
  expect(generated).toBe(0);
});

test('a visual provider timeout preserves alternatives and counts an unknown-cost attempted generation', async () => {
  const photo = await fixture();
  mock.method(photos, 'fetchProductPhoto', async () => photo);
  mock.method(ToolLoopAgent.prototype, 'generate', async () => {
    throw new Error('Provider timed out after dispatch');
  });
  const candidates = listings().map((listing) => ({
    ...listing,
    match: 'possible-exact' as const,
  }));
  const result = await reviewProductPhotos(item, candidates, photo);
  expect(result).toMatchObject({ cost: null, generationCount: 1 });
  expect(result.listings).toHaveLength(8);
  expect(
    result.listings.every(
      (listing) =>
        listing.visualReview?.status === 'not-reviewed' &&
        listing.identityEvidence === 'unverified' &&
        listing.match === 'similar',
    ),
  ).toBe(true);
});

test('invalid visual output preserves its receipt for reconciliation without granting a free generation or exact match', async () => {
  const photo = await fixture();
  mock.method(photos, 'fetchProductPhoto', async () => photo);
  const count = db.agentRequest.count;
  const upsert = db.agentGeneration.upsert;
  const receipts: unknown[] = [];
  db.agentRequest.count = (async () => 1) as typeof count;
  db.agentGeneration.upsert = (async (value: unknown) => {
    receipts.push(value);
    return {};
  }) as typeof upsert;
  mock.method(
    ToolLoopAgent.prototype,
    'generate',
    async function (this: { settings: { onStepEnd: (step: unknown) => Promise<void> } }) {
      const providerMetadata = { gateway: { generationId: 'visual-receipt', cost: '0.000250' } };
      await this.settings.onStepEnd({ providerMetadata });
      return {
        providerMetadata,
        totalUsage: { inputTokens: 8, outputTokens: 8 },
        output: {
          reviews: [{ sourceIndex: 7, status: 'consistent', note: 'Unsupported unseen candidate' }],
        },
      };
    },
  );
  try {
    const result = await withAgentUsage('owner', 'request', () =>
      reviewProductPhotos(item, listings(), photo),
    );
    expect(result).toMatchObject({ cost: null, generationCount: 1 });
    expect(
      result.listings.every(
        (listing) =>
          listing.identityEvidence === 'unverified' &&
          listing.visualReview?.status === 'not-reviewed',
      ),
    ).toBe(true);
    expect(receipts).toContainEqual({
      where: { id: 'visual-receipt', requestId: 'request' },
      create: { id: 'visual-receipt', requestId: 'request', costMicros: 250 },
      update: { costMicros: 250 },
    });
  } finally {
    db.agentRequest.count = count;
    db.agentGeneration.upsert = upsert;
  }
});
