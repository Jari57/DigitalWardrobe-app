import { test, expect } from '@playwright/test';
import { safeFeedImage } from '../../src/server/trend-feed';

test('publisher image URLs decode escaped query separators while retaining the host allowlist', () => {
  expect(safeFeedImage('https://i.guim.co.uk/photo.jpg?width=140&amp;quality=85&#38;fit=max')).toBe(
    'https://i.guim.co.uk/photo.jpg?width=140&quality=85&fit=max',
  );
  expect(safeFeedImage('https://untrusted.example/photo.jpg')).toBeNull();
});

test('audience switches visibly before saving completes and failed photos do not leave blank discovery cards', async ({
  page,
}) => {
  let releaseSave!: () => void;
  const save = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  const item = (id: string, title: string, imageUrl: string | null) => ({
    id,
    title,
    imageUrl,
    publisher: 'Esquire',
    url: `https://example.com/${id}`,
    publishedAt: new Date().toISOString(),
    categories: ['tops'],
    aesthetics: [],
    reason: 'Style idea',
    saved: true,
  });
  const men = item('men', 'Menswear linen outfit', '/icons/icon-192.png');
  const women = item('women', 'Womenswear summer outfit', '/icons/icon-192.png');
  const missing = item('missing', 'A story without a photo', null);
  const broken = item('broken', 'A broken publisher photo', '/broken-feed-photo.jpg');
  await page.route('**/broken-feed-photo.jpg', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/for-you/preferences') {
      await Promise.race([save, new Promise((resolve) => setTimeout(resolve, 1500))]);
      return route.fulfill({ json: { ok: true } });
    }
    if (url.pathname === '/api/for-you') {
      const audience = url.searchParams.get('audience') ?? 'all-styles';
      const items =
        url.searchParams.get('mode') === 'saved'
          ? [men, women, missing, broken]
          : audience === 'menswear'
            ? [men, missing, broken]
            : audience === 'womenswear'
              ? [women]
              : [men, women, missing, broken];
      return route.fulfill({
        json: {
          items,
          authenticated: true,
          preferences: { categories: [], aesthetics: [audience], region: 'US' },
          checkedAt: null,
        },
      });
    }
    return route.fulfill({
      json:
        url.pathname === '/api/session'
          ? { user: { id: 'owner', username: 'tester' } }
          : url.pathname === '/api/wardrobe'
            ? { garments: [], outfits: [], references: [] }
            : { detections: [], searches: [], draft: [], recent: [] },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'For You', exact: true }).click();
  const feed = page.getByRole('region', { name: 'For You feed' });
  await expect(feed.getByRole('heading', { name: women.title })).toBeVisible();
  await feed.getByRole('heading', { name: broken.title }).scrollIntoViewIfNeeded();
  await expect(feed.locator('.feed-card')).toHaveCount(2);
  await feed.getByRole('button', { name: 'Menswear', exact: true }).click();
  await expect(feed.getByRole('button', { name: 'Menswear', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(feed.getByRole('heading', { name: men.title })).toBeVisible();
  await expect(feed.getByRole('heading', { name: women.title })).toHaveCount(0);
  await expect(feed.locator('.feed-card')).toHaveCount(1);
  releaseSave();
  await feed.getByRole('button', { name: 'Womenswear', exact: true }).click();
  await expect(feed.getByRole('heading', { name: women.title })).toBeVisible();
  await expect(feed.getByRole('heading', { name: men.title })).toHaveCount(0);
  await feed.getByRole('button', { name: 'Both', exact: true }).click();
  await expect(feed.locator('.feed-card')).toHaveCount(2);
  await feed.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(feed.getByRole('heading', { name: missing.title })).toBeVisible();
  await expect(feed.locator('.feed-card')).toHaveCount(4);
});
