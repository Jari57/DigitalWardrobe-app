import { test, expect } from '@playwright/test';
test('desktop uses wide navigation and a responsive multi-column feed', async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === '/api/for-you'
          ? {
              authenticated: false,
              preferences: { categories: [], aesthetics: [], region: 'US' },
              sources: [],
              items: Array.from({ length: 6 }, (_, i) => ({
                id: String(i),
                title: `Style story ${i}`,
                url: 'https://www.elle.com/fashion/',
                publisher: 'ELLE',
                publishedAt: new Date().toISOString(),
                categories: ['tops'],
                aesthetics: [],
                reason: 'Style idea',
              })),
            }
          : { user: null },
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(page.getByRole('button', { name: /Put a fit together From/ })).toBeVisible();
  expect((await page.locator('.app-shell').boundingBox())!.width).toBeGreaterThan(1200);
  expect((await nav.boundingBox())!.y).toBeLessThan(200);
  await page.screenshot({ path: 'test-results/desktop-spotter.png', fullPage: true });
  await nav.getByRole('button', { name: 'For You', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(6);
  const cards = page.getByRole('article');
  const first = (await cards.nth(0).boundingBox())!;
  const third = (await cards.nth(2).boundingBox())!;
  expect(third.y).toBe(first.y);
  expect(third.x).toBeGreaterThan(first.x);
  await page.screenshot({ path: 'test-results/desktop-feed.png', fullPage: true });
  await page.setViewportSize({ width: 820, height: 1000 });
  expect((await cards.nth(1).boundingBox())!.y).toBe((await cards.nth(0).boundingBox())!.y);
  expect((await cards.nth(2).boundingBox())!.y).toBeGreaterThan(
    (await cards.nth(0).boundingBox())!.y,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await cards.nth(1).boundingBox())!.y).toBeGreaterThan(
    (await cards.nth(0).boundingBox())!.y,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await nav.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
});
import {
  fetchFashionSource,
  feedSources,
  parseFashionFeed,
  safeFeedImage,
} from '../../src/server/trend-feed';
import { balancePublishers } from '../../src/lib/feed-sources';
import { discoveryRequestKey } from '../../src/server/agents/discovery-key';
import { clothingPreferenceContext } from '../../src/lib/clothing-preference';

test('shopping cache changes with clothing preference while the same photo scan stays reusable', () => {
  const day = '2026-09-26';
  const shop = { agent: 'shop', detectionId: 'scan', itemIndex: 0, country: 'US' };
  expect(discoveryRequestKey(shop, day, 'none', 'menswear')).not.toBe(
    discoveryRequestKey(shop, day, 'none', 'womenswear'),
  );
  expect(discoveryRequestKey(shop, day, 'none', 'all-styles')).not.toBe(
    discoveryRequestKey(shop, day, 'none', 'menswear'),
  );
  const scan = { agent: 'detect', imageId: 'photo' };
  expect(discoveryRequestKey(scan, day, 'none', 'menswear')).toBe(
    discoveryRequestKey(scan, day, 'none', 'womenswear'),
  );
  expect(clothingPreferenceContext().department).toContain('unisex');
  expect(clothingPreferenceContext('menswear').department).toBe('menswear');
});
import {
  defaultPreferences,
  preferenceSchema,
  rankFeed,
  setAudience,
  selectedAudience,
} from '../../src/lib/for-you';

test('clothing preference is explicit, mutually exclusive, and never hides saved outfits', () => {
  const now = new Date();
  const item = (id: string, title: string, publisher: string) => ({
    id,
    title,
    publisher,
    url: 'https://example.com/' + id,
    publishedAt: now,
    categories: ['shoes'],
    aesthetics: [],
  });
  const items = [
    item('women', "Women's sneakers", 'GQ'),
    item('men', "Men's sneakers", 'ELLE'),
    item('shared', 'Classic sneakers', 'Hypebeast'),
  ];
  const preferences = setAudience(defaultPreferences, 'menswear');
  expect(
    rankFeed(items, preferences, [], 'latest', now)
      .map((item) => item.id)
      .sort(),
  ).toEqual(['men', 'shared']);
  expect(rankFeed(items, setAudience(preferences, 'all-styles'), [], 'latest', now)).toHaveLength(
    3,
  );
  expect(selectedAudience(setAudience(preferences, 'womenswear'))).toBe('womenswear');
  expect(
    preferenceSchema.safeParse({ ...preferences, aesthetics: ['menswear', 'womenswear'] }).success,
  ).toBe(false);
  expect(
    rankFeed(
      items,
      preferences,
      [{ itemId: 'women', saved: true, liked: false, hidden: false, item: items[0] }],
      'saved',
      now,
    ).map((item) => item.id),
  ).toEqual(['women']);
});

test('all ten publisher routes ingest dated garment stories without allowing cross-host links', () => {
  const now = new Date('2026-09-26T12:00:00Z');
  const paths = [
    '/fashion/shoes/test',
    '/fashion/test',
    '/fashion/test',
    '/style/test',
    '/2026/09/test',
    '/fashion/2026/sep/26/test',
    '/2026/9/test',
    '/p/test/',
    '/story/test',
    '/article/test',
  ];
  expect(feedSources).toHaveLength(10);
  feedSources.forEach((source, index) => {
    const xml = `<rss><channel><item><title>Classic loafers</title><link>https://${source.host}${paths[index]}</link><pubDate>${now.toUTCString()}</pubDate></item></channel></rss>`;
    expect(parseFashionFeed(xml, source, now)).toHaveLength(1);
    expect(
      parseFashionFeed(xml.replace(source.host, source.host + '.evil.example'), source, now),
    ).toHaveLength(0);
  });
  const atom = `<feed><entry><title type="text">Classic loafers</title><link rel="alternate" href="https://www.gq.com/story/test"/><published>${now.toISOString()}</published><summary><![CDATA[<img src="https://media.gq.com/photo.jpg">]]></summary></entry></feed>`;
  expect(parseFashionFeed(atom, feedSources[8], now)[0].imageUrl).toBe(
    'https://media.gq.com/photo.jpg',
  );
  expect(safeFeedImage('https://media.gq.com.evil.example/photo.jpg')).toBeNull();
  expect(safeFeedImage('https://media.gq.com:8443/photo.jpg')).toBeNull();
});

test('publisher diversity preserves within-source ranking and does not discard the remaining stories', () => {
  const items = [1, 2, 3, 4].map((id) => ({ id, publisher: 'Busy source' }));
  items.push({ id: 5, publisher: 'Small source' }, { id: 6, publisher: 'Third source' });
  expect(balancePublishers(items, 4).map((item) => item.id)).toEqual([1, 5, 6, 2]);
  expect(balancePublishers(items, 60)).toHaveLength(6);
  expect(balancePublishers([], 60)).toEqual([]);
});

test('publisher redirects stay on the source host; empty coverage is not a successful refresh', async () => {
  const original = globalThis.fetch;
  const now = new Date();
  const xml = `<rss><channel><item><title>Classic loafers</title><link>https://www.whowhatwear.com/fashion/shoes/test</link><pubDate>${now.toUTCString()}</pubDate></item></channel></rss>`;
  let calls = 0;
  try {
    globalThis.fetch = async () =>
      ++calls === 1
        ? new Response(null, { status: 301, headers: { location: '/feeds/fashion' } })
        : new Response(xml);
    expect(await fetchFashionSource(feedSources[0], now)).toHaveLength(1);
    expect(calls).toBe(2);
    globalThis.fetch = async () =>
      new Response(null, { status: 302, headers: { location: 'https://evil.example/feed' } });
    await expect(fetchFashionSource(feedSources[0], now)).rejects.toThrow('Unsafe feed redirect');
    globalThis.fetch = async () => new Response(xml.replace('Classic loafers', 'Celebrity dinner'));
    await expect(fetchFashionSource(feedSources[0], now)).rejects.toThrow(
      'No current fashion coverage',
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('manual feed refresh requires same-origin authentication', async ({ request, baseURL }) => {
  expect(
    (await request.post('/api/for-you', { headers: { Origin: 'https://evil.example' } })).status(),
  ).toBe(403);
  expect((await request.post('/api/for-you', { headers: { Origin: baseURL! } })).status()).toBe(
    401,
  );
});

test('daily styling takes plans through to a saved fit without canvas; feed refresh shows new content', async ({
  page,
}) => {
  const piece = {
    id: 'shirt',
    name: 'White shirt',
    category: 'tops',
    color: '#ffffff',
    brand: '',
    imageUrl: '/icons/icon-192.png',
    price: null,
    wearCount: 0,
  };
  let outfits: unknown[] = [];
  let refreshes = 0;
  let stylistCalls = 0;
  let interests = { categories: [] as string[], aesthetics: [] as string[], region: 'US' };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path === '/api/session') body = { user: { id: 'owner', username: 'tester' } };
    if (path === '/api/wardrobe') body = { garments: [piece], outfits, references: [] };
    if (path === '/api/discovery') body = { detections: [], searches: [] };
    if (path === '/api/experience') body = { draft: [], recent: [] };
    if (path === '/api/for-you/preferences') {
      interests = route.request().postDataJSON();
      body = { ok: true };
    }
    if (path === '/api/stylist') {
      stylistCalls++;
      expect(route.request().postDataJSON().occasion).toBe(
        'Client meeting, then dinner. Comfortable shoes.',
      );
      body = {
        garmentIds: ['shirt'],
        explanation: 'Use your white shirt as the starting point.',
        limitations: ['Add bottoms and shoes for a complete outfit.'],
      };
    }
    if (path === '/api/outfits') {
      const input = route.request().postDataJSON();
      expect(input.pieces[0].garmentId).toBe('shirt');
      outfits = [{ ...input, id: 'saved-fit' }];
      body = { outfit: outfits[0] };
    }
    if (path === '/api/for-you') {
      if (route.request().method() === 'POST') refreshes++;
      body = {
        authenticated: true,
        preferences: interests,
        checkedAt: new Date().toISOString(),
        stale: false,
        sourcesUnavailable: false,
        sources: [
          { name: 'ELLE', status: 'available' },
          { name: 'GQ', status: 'unavailable' },
        ],
        items: [
          {
            id: refreshes ? 'new' : 'old',
            title: refreshes ? 'New weekend loafers' : 'Classic white shirts',
            url: 'https://www.elle.com/fashion/example',
            publisher: 'ELLE',
            publishedAt: new Date().toISOString(),
            categories: ['tops'],
            aesthetics: [],
            liked: false,
            saved: false,
            reason: 'Style idea',
          },
        ],
      };
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/');
  await expect(
    page.getByRole('region', { name: 'Your style shortcuts' }).getByRole('button'),
  ).toHaveCount(2);
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button'),
  ).toHaveCount(4);
  await page.getByRole('button', { name: /Put a fit together From your closet/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Occasion').fill('Client meeting, then dinner. Comfortable shoes.');
  await dialog.getByRole('button', { name: 'Style with AI' }).click();
  await dialog.getByRole('button', { name: 'Save this fit', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Saved to My fits' })).toBeDisabled();
  expect(stylistCalls).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('navigation').getByRole('button', { name: 'My fits' }).click();
  await expect(
    page.getByRole('heading', { name: 'Client meeting, then dinner. Comfortable shoes. fit' }),
  ).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'For You' }).click();
  await expect(page.getByRole('heading', { name: 'Classic white shirts' })).toBeVisible();
  await page.getByRole('button', { name: 'Menswear', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Menswear', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(interests.aesthetics).toEqual(['menswear']);
  expect(stylistCalls).toBe(1);
  await page.getByText('Explore our sources (1 with current stories)').click();
  await expect(page.getByText('GQ — Temporarily unavailable')).toBeVisible();
  await page.getByRole('button', { name: 'Refresh feed' }).click();
  await expect(page.getByRole('heading', { name: 'New weekend loafers' })).toBeVisible();
  await expect(page.getByText('1 new ideas added.')).toBeVisible();
  await page.getByRole('button', { name: 'Refresh feed' }).click();
  await expect(
    page.getByText('You are up to date. No new stories since your last check.'),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/daily-ux.png', fullPage: true });
  await page.getByRole('button', { name: 'Stalk a fit', exact: true }).click();
  await expect(
    page.getByRole('navigation').getByRole('button', { name: 'Spotter' }),
  ).toHaveAttribute('aria-current', 'page');
  expect(stylistCalls).toBe(1);
});
