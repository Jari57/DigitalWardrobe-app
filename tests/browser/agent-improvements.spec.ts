import { test, expect } from '@playwright/test';
import type { DetectedItem, ShoppingResult } from '../../src/lib/discovery';
import {
  verifiedIdentityEvidence,
  matchVerdict,
  verifiedListings,
} from '../../src/lib/match-verifier';
import { rankFeed, tasteSignals, defaultPreferences } from '../../src/lib/for-you';
import { outfitGaps, outfitSwaps } from '../../src/lib/outfit-assistant';
import { agentRequestSchema } from '../../src/server/agents/contracts';
import { qualityStylist } from '../../src/server/agents/quality';

const item: DetectedItem = {
  name: 'White sneakers',
  category: 'shoes',
  color: '#ffffff',
  description: 'Low-top white shoes',
  visibleBrand: 'Example',
  readableText: ['AB1234'],
  visibleModelCode: 'AB1234',
  uncertainty: '',
};
const listing: ShoppingResult['listings'][number] = {
  title: 'Example white sneakers',
  url: 'https://shop.example/products/white',
  retailer: 'Example',
  reason: 'Same shape',
  match: 'possible-exact',
  visualReview: { status: 'consistent', note: 'Color and shape agree.' },
  evidence: {
    sourceUrl: 'https://shop.example/products/white',
    checkedAt: '2026-09-26T12:00:00Z',
    availability: 'unknown',
    brand: 'Example',
    modelCode: 'AB1234',
    note: 'Retailer metadata',
  },
};
test('identity requires readable code, matching brand and visual evidence', () => {
  expect(verifiedIdentityEvidence(item, listing)).toBe('matching-code-and-visuals');
  for (const changed of [
    { ...item, readableText: [] },
    { ...item, readableText: ['AB12345'] },
    { ...item, visibleBrand: 'Different' },
    { ...item, visibleModelCode: null },
  ])
    expect(verifiedIdentityEvidence(changed, listing)).toBe('unverified');
  expect(
    matchVerdict(item, { ...listing, evidence: { ...listing.evidence!, modelCode: 'XY9876' } })
      .label,
  ).toContain('different model');
});
test('verifier rejects visual conflicts and orders supported evidence first', () => {
  const weak = { ...listing, url: listing.url + '-weak', visualReview: undefined };
  const bad = {
    ...listing,
    visualReview: { status: 'different' as const, note: 'Wrong silhouette' },
  };
  const results = verifiedListings(item, [weak, bad, listing]);
  expect(results).toHaveLength(2);
  expect(results[0].identityEvidence).toBe('matching-code-and-visuals');
  expect(results[1].match).toBe('similar');
  expect(matchVerdict(item, weak).label).toContain('needs checking');
});
const now = new Date('2026-09-26T12:00:00Z');
const story = (id: string, days = 0) => ({
  id,
  title: 'Classic shirts',
  url: `https://www.elle.com/fashion/${id}`,
  publisher: 'ELLE',
  categories: ['tops'],
  aesthetics: ['classic'],
  publishedAt: new Date(+now - days * 86400000),
});
test('taste learning decays and saved content does not crowd out equally relevant new ideas', () => {
  const feedback = {
    itemId: 'saved',
    liked: true,
    saved: true,
    hidden: false,
    item: story('saved'),
    updatedAt: now,
  };
  const old = { ...feedback, updatedAt: new Date(+now - 90 * 86400000) };
  expect(tasteSignals([old], now).get('classic')).toBeLessThan(
    tasteSignals([feedback], now).get('classic')!,
  );
  expect(
    rankFeed([story('saved'), story('new')], defaultPreferences, [feedback], 'for-you', now)[0].id,
  ).toBe('new');
  expect(
    rankFeed(
      [story('saved')],
      { ...defaultPreferences, aesthetics: ['menswear'] },
      [feedback],
      'saved',
      now,
    ),
  ).toHaveLength(1);
  expect(
    rankFeed([story('saved')], defaultPreferences, [{ ...feedback, hidden: true }], 'for-you', now),
  ).toHaveLength(0);
});
test('curator removes tracking URL duplicates and never gives future stories a freshness bonus', () => {
  const same = { ...story('duplicate'), url: story('first').url + '?utm_source=test' };
  expect(rankFeed([story('first'), same], defaultPreferences, [], 'for-you', now)).toHaveLength(1);
  expect(
    rankFeed([story('a', 0), story('z', -100)], defaultPreferences, [], 'for-you', now)[0].id,
  ).toBe('a');
});
const closet = [
  { id: 'top', name: 'White shirt', category: 'tops' },
  { id: 'top2', name: 'Blue shirt', category: 'tops' },
  { id: 'bottom', name: 'Jeans', category: 'bottoms' },
];
test('gap finder suggests owned pieces before additions and respects dresses', () => {
  const gaps = outfitGaps([closet[0]], closet);
  expect(gaps.find((gap) => gap.category === 'bottoms')?.owned[0].id).toBe('bottom');
  expect(gaps.find((gap) => gap.category === 'shoes')?.owned).toEqual([]);
  expect(
    outfitGaps([{ id: 'dress', name: 'Dress', category: 'dresses' }], closet).map(
      (gap) => gap.category,
    ),
  ).toEqual(['shoes']);
  expect(outfitGaps([], closet)).toEqual([]);
});
test('manual swaps preserve locks and never introduce unowned or duplicate pieces', () => {
  expect(outfitSwaps(closet[0], closet, [closet[0]], ['top'])).toEqual([]);
  expect(outfitSwaps(closet[0], closet, [closet[0]], []).map((piece) => piece.id)).toEqual([
    'top2',
  ]);
  expect(outfitSwaps(closet[0], closet, closet, [])).toEqual([]);
});
test('day context is bounded and generation gate still preserves ownership and locks', () => {
  const input = {
    agent: 'stylist',
    candidateIds: ['top'],
    lockedIds: ['top'],
    occasion: 'Dinner',
    aesthetic: 'Classic',
    dayContext: 'Walking; cool evening',
  };
  expect(agentRequestSchema.safeParse(input).success).toBe(true);
  expect(agentRequestSchema.safeParse({ ...input, dayContext: 'x'.repeat(241) }).success).toBe(
    false,
  );
  const output = qualityStylist(
    { garmentIds: ['invented', 'top2'], explanation: 'Proposal', limitations: [] },
    closet,
    ['top'],
  );
  expect(output.garmentIds).toContain('top');
  expect(output.garmentIds).not.toContain('invented');
  expect(output.garmentIds).not.toContain('top2');
});
