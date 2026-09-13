import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadEnvConfig } from '@next/env';
import { defaultPreferences, rankFeed } from '../../src/lib/for-you';
import { feedSources, parseFashionFeed, safeFeedImage } from '../../src/server/trend-feed';
loadEnvConfig(process.cwd());

test('feed ingestion rejects unsafe media, old/future stories and paid entries', () => {
  const now = new Date('2026-09-13T12:00:00Z');
  const entry = (extra = '', url = 'https://www.whowhatwear.com/fashion/shoes/loafers') =>
    `<item><title>Classic loafers</title><link>${url}</link><pubDate>Sat, 12 Sep 2026 20:00:00 GMT</pubDate><media:content url="https://cdn.mos.cms.futurecdn.net/photo.jpg"><media:credit>Photographer</media:credit></media:content>${extra}</item>`;
  const xml = `<rss><channel>${entry()}${entry('<cf:isSponsored>true</cf:isSponsored>')}${entry('', 'https://attacker.example/fashion/shoes')}</channel></rss>`;
  const items = parseFashionFeed(xml, feedSources[0], now);
  expect(items).toHaveLength(1);
  expect(
    parseFashionFeed(
      xml.replaceAll('Classic loafers', 'Inside a fashion week dinner'),
      feedSources[0],
      now,
    ),
  ).toHaveLength(0);
  expect(items[0]).toMatchObject({
    categories: ['shoes'],
    aesthetics: ['classic'],
    imageCredit: 'Photographer',
  });
  expect(parseFashionFeed(xml, feedSources[0], new Date('2026-08-01'))).toHaveLength(0);
  expect(parseFashionFeed(xml, feedSources[0], new Date('2026-12-01'))).toHaveLength(0);
  expect(() => parseFashionFeed('<!DOCTYPE rss><rss/>', feedSources[0])).toThrow();
  expect(safeFeedImage('https://cdn.mos.cms.futurecdn.net.attacker.example/a.jpg')).toBeNull();
  expect(safeFeedImage('http://cdn.mos.cms.futurecdn.net/a.jpg')).toBeNull();
});

test('ranking respects interests, saved items and hidden items without invented momentum', () => {
  const now = new Date(),
    base = {
      title: 'Fixture',
      url: 'https://www.elle.com/fashion/fixture',
      publisher: 'ELLE',
      publishedAt: now,
      aesthetics: [],
    };
  const items = [
    { ...base, id: 'dress', categories: ['dresses'] },
    { ...base, id: 'shoe', categories: ['shoes'] },
  ];
  expect(
    rankFeed(items, { ...defaultPreferences, categories: ['shoes'] }, [], 'for-you')[0].id,
  ).toBe('shoe');
  const feedback = [{ itemId: 'shoe', liked: true, saved: true, hidden: false, item: items[1] }];
  expect(rankFeed(items, defaultPreferences, feedback, 'saved').map((item) => item.id)).toEqual([
    'shoe',
  ]);
  expect(
    rankFeed(items, defaultPreferences, [{ ...feedback[0], hidden: true }], 'for-you').map(
      (item) => item.id,
    ),
  ).toEqual(['dress']);
});

test('hourly refresh is protected and seeds real publisher photos without AI', async ({
  request,
}) => {
  test.skip(process.env.LIVE_TREND_REFRESH !== 'true', 'Opt-in public RSS refresh, no AI calls.');
  expect((await request.get('/api/cron/trends')).status()).toBe(401);
  const response = await request.get('/api/cron/trends', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(response.status(), await response.text()).toBe(200);
  const feed = await (await request.get('/api/for-you')).json();
  expect(feed.items.length).toBeGreaterThan(0);
  expect(feed.items.some((item: { imageUrl?: string }) => !!item.imageUrl)).toBe(true);
  expect(
    (
      await (
        await request.get('/api/cron/trends', {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        })
      ).json()
    ).skipped,
  ).toBe(true);
  console.log(
    JSON.stringify({
      items: feed.items.length,
      withPhotos: feed.items.filter((item: { imageUrl?: string }) => !!item.imageUrl).length,
    }),
  );
});

test('visual feed saves private preferences, likes and bookmarks, with hide and undo', async ({
  page,
  context,
  browser,
}) => {
  const db = new PrismaClient(),
    id = `qa-feed-${randomBytes(8).toString('hex')}`,
    password = randomBytes(20).toString('hex'),
    headers = { Origin: 'http://localhost:3100' };
  const fixture = await db.trendItem.create({
    data: {
      id,
      url: `https://www.whowhatwear.com/fashion/${id}`,
      title: 'Classic loafers for your next outfit',
      publisher: 'QA fixture',
      publishedAt: new Date(),
      categories: ['shoes'],
      aesthetics: ['classic'],
      imageUrl: 'https://cdn.mos.cms.futurecdn.net/fixture.jpg',
    },
  });
  await page.route('https://cdn.mos.cms.futurecdn.net/fixture.jpg', (route) => route.abort());
  expect(
    (
      await context.request.post('/api/auth', {
        headers,
        data: { action: 'signup', username: `qa_${randomBytes(8).toString('hex')}`, password },
      })
    ).status(),
  ).toBe(201);
  let paid = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      /api\/(stylist|discovery|spotter|creator)/.test(request.url())
    )
      paid++;
  });
  try {
    await page.goto('/');
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'For You', exact: true })
      .click();
    await page.getByRole('button', { name: 'Edit interests' }).click();
    await page.getByRole('button', { name: 'shoes', exact: true }).click();
    await page.getByRole('button', { name: 'classic', exact: true }).click();
    await page.getByRole('button', { name: 'Save interests' }).click();
    const card = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: fixture.title, exact: true }) });
    await card.getByRole('button', { name: 'Save idea', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Unsave idea', exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Like idea', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Unlike idea', exact: true })).toBeVisible();
    await page.reload();
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'For You', exact: true })
      .click();
    await page.getByRole('button', { name: 'Saved', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(1);
    expect(
      (await (await context.request.get('/api/for-you')).json()).preferences.categories,
    ).toEqual(['shoes']);
    const outsider = await browser.newContext({ baseURL: 'http://localhost:3100' });
    try {
      expect((await (await outsider.request.get('/api/for-you?mode=saved')).json()).items).toEqual(
        [],
      );
      expect(
        (
          await outsider.request.post('/api/for-you/feedback', {
            headers,
            data: { itemId: id, action: 'save' },
          })
        ).status(),
      ).toBe(401);
    } finally {
      await outsider.close();
    }
    await card.getByText('Why this?', { exact: true }).click();
    await card.getByRole('button', { name: 'Not interested' }).click();
    await expect(page.getByRole('article')).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.getByRole('button', { name: 'For you', exact: true }).click();
    await expect(card).toBeVisible();
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(paid).toBe(0);
  } finally {
    await context.request.delete('/api/account', { headers, data: { password } });
    await db.trendItem.delete({ where: { id } });
    await db.$disconnect();
  }
});

test('live feed photographs load in light and dark mobile layouts', async ({ page }) => {
  test.skip(process.env.LIVE_TREND_REFRESH !== 'true', 'Opt-in publisher image check.');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'For You', exact: true }).click();
  const photo = page.locator('img.feed-photo').first();
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBeGreaterThan(0);
  await page.screenshot({ path: '../for-you-light.png' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: '../for-you-dark.png' });
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
