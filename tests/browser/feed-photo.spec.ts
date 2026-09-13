import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { fetchFeedPhoto } from '../../src/server/feed-photo';
import { mock } from 'node:test';
import dns from 'node:dns/promises';

test('publisher photo refuses arbitrary hosts and private DNS destinations', async () => {
  await expect(fetchFeedPhoto('https://localhost/image.png')).rejects.toThrow();
  await expect(fetchFeedPhoto('https://example.com/image.png')).rejects.toThrow();
  const lookup = mock.method(dns, 'lookup', async () => [{ address: '127.0.0.1', family: 4 }]);
  try {
    await expect(fetchFeedPhoto('https://hips.hearstapps.com/image.png')).rejects.toThrow(
      'Blocked image address',
    );
  } finally {
    lookup.mock.restore();
  }
});

test('For You identifies the selected image in Spotter with no Google or automatic AI request', async ({
  page,
}) => {
  const photo = await sharp({
    create: { width: 100, height: 150, channels: 3, background: '#887788' },
  })
    .webp()
    .toBuffer();
  let paid = 0;
  let requestedId = '';
  await page.route('**/api/session', (route) => route.fulfill({ json: { user: null } }));
  await page.route('**/api/for-you?*', (route) =>
    route.fulfill({
      json: {
        authenticated: false,
        preferences: { aesthetics: [], categories: [], region: 'US' },
        checkedAt: null,
        sourcesUnavailable: false,
        items: [
          {
            id: 'a'.repeat(64),
            title: 'The selected silk look',
            url: 'https://www.elle.com/fashion/example',
            publisher: 'ELLE',
            imageUrl: 'https://hips.hearstapps.com/fixture.webp',
            publishedAt: new Date().toISOString(),
            categories: ['tops'],
            aesthetics: ['minimal'],
            liked: false,
            saved: false,
            reason: 'Fresh',
          },
        ],
      },
    }),
  );
  await page.route('https://hips.hearstapps.com/fixture.webp', (route) =>
    route.fulfill({ contentType: 'image/webp', body: photo }),
  );
  await page.route('**/api/for-you/photo', (route) => {
    requestedId = route.request().postDataJSON().itemId;
    return route.fulfill({ contentType: 'image/webp', body: photo });
  });
  await page.route('**/api/discovery', (route) => {
    if (route.request().method() === 'POST') paid++;
    return route.fulfill({ json: { detections: [], enabled: true } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'For You', exact: true }).click();
  await expect(page.locator('a[href*="google.com/search"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Identify this look', exact: true }).click();
  await expect(page.getByAltText('Your selected screenshot')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Identify clothes', exact: true })).toBeVisible();
  expect(requestedId).toBe('a'.repeat(64));
  expect(paid).toBe(0);
  await page.getByRole('button', { name: 'Identify clothes', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(paid).toBe(0);
});
