import { test, expect } from '@playwright/test';
import { fetchFashionSource, feedSources } from '../../src/server/trend-feed';

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
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path === '/api/session') body = { user: { id: 'owner', username: 'tester' } };
    if (path === '/api/wardrobe') body = { garments: [piece], outfits, references: [] };
    if (path === '/api/discovery') body = { detections: [], searches: [] };
    if (path === '/api/experience') body = { draft: [], recent: [] };
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
        preferences: { categories: [], aesthetics: [], region: 'US' },
        checkedAt: new Date().toISOString(),
        stale: false,
        sourcesUnavailable: false,
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
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button'),
  ).toHaveCount(4);
  await page.getByRole('button', { name: /Style me For whatever/ }).click();
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
});
