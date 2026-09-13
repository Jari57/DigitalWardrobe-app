import { test, expect } from '@playwright/test';
import september from '../../src/content/trends/2026-09.json';
import { selectTrendEdition, trendEditionSchema } from '../../src/lib/trends';

test('editions require evidence, valid dates and an honest previous-month state', () => {
  const edition = trendEditionSchema.parse(september);
  expect(edition.picks).toHaveLength(10);
  expect(selectTrendEdition([edition], new Date('2026-09-12T12:00:00Z')).previous).toBe(false);
  expect(selectTrendEdition([edition], new Date('2026-10-01T12:00:00Z')).previous).toBe(true);
  expect(selectTrendEdition([edition], new Date('2026-09-01T12:00:00Z')).edition).toBeNull();
  expect(trendEditionSchema.safeParse({ ...edition, reviewedAt: '2026-99-99' }).success).toBe(
    false,
  );
  expect(
    trendEditionSchema.safeParse({
      ...edition,
      picks: [{ ...edition.picks[0], sourceId: 'missing' }],
    }).success,
  ).toBe(false);
  expect(
    trendEditionSchema.safeParse({
      ...edition,
      sources: [{ ...edition.sources[0], publishedAt: '2027-01-01' }],
    }).success,
  ).toBe(false);
});

test('historical monthly edition remains available as an archive', async ({ request }) => {
  const response = await request.get('/api/trends');
  expect(response.status()).toBe(200);
  expect((await response.json()).edition.picks).toHaveLength(10);
});
