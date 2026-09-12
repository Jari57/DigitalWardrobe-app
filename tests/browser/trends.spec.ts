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

test('monthly edit is shared, sourced and opens styling without paid requests', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/trends');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('public');
  expect((await response.json()).edition.picks).toHaveLength(10);
  let paidCalls = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && /api\/(stylist|discovery|spotter)/.test(request.url()))
      paidCalls++;
  });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Spotter', exact: true }).click();
  await page.getByRole('button', { name: /The monthly trend edit/ }).click();
  const edit = page.getByRole('region', { name: 'Monthly trend edit' });
  await expect(edit.getByRole('article')).toHaveCount(10);
  await expect(edit.getByRole('link', { name: /Vogue/ }).first()).toHaveAttribute(
    'href',
    september.sources[0].url,
  );
  await expect(edit.getByRole('link', { name: 'Search shops' }).first()).toHaveAttribute(
    'href',
    /tbm=shop/,
  );
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../monthly-trends-mobile.png', fullPage: true });
  await edit.getByRole('button', { name: 'Style with my closet' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Add pieces to your closet');
  expect(paidCalls).toBe(0);
});
