import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { arrange } from '../../src/components/OutfitCanvas';
import type { Garment } from '../../src/lib/types';
test('all twelve automatically arranged pieces stay on the canvas without overlaps', () => {
  const garments = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }) as Garment);
  for (let count = 1; count <= 12; count++) {
    const pieces = arrange(garments.slice(0, count));
    expect(pieces).toHaveLength(count);
    for (const p of pieces) {
      expect(p.x + 34 * p.scale).toBeLessThanOrEqual(100);
      expect(p.y + 25 * p.scale).toBeLessThanOrEqual(100);
    }
    for (let i = 0; i < pieces.length; i++)
      for (let j = i + 1; j < pieces.length; j++) {
        const a = pieces[i],
          b = pieces[j];
        expect(
          a.x + 34 * a.scale <= b.x ||
            b.x + 34 * b.scale <= a.x ||
            a.y + 25 * a.scale <= b.y ||
            b.y + 25 * b.scale <= a.y,
        ).toBe(true);
      }
  }
});

test('mobile try-on previews locally, requires consent and recovers after an interrupted response', async ({
  page,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_FITSTALKER_TRY_ON_ENABLED !== 'true',
    'Requires a flag-enabled app build.',
  );
  await page.setViewportSize({ width: 360, height: 780 });
  const original = await sharp({
    create: { width: 64, height: 96, channels: 3, background: '#324455' },
  })
    .png()
    .toBuffer();
  const result = await sharp({
    create: { width: 64, height: 96, channels: 3, background: '#836255' },
  })
    .webp()
    .toBuffer();
  let uploads = 0;
  let attempts = 0;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    switch (new URL(request.url()).pathname) {
      case '/api/session':
        return route.fulfill({ json: { user: { id: 'fixture-owner', username: 'owner' } } });
      case '/api/wardrobe':
        return route.fulfill({
          json: {
            garments: [
              {
                id: 'jacket',
                name: 'Denim jacket',
                imageUrl: '/icons/icon-192.png',
                category: 'outerwear',
                brand: '',
                color: '#334455',
                wearCount: 0,
              },
            ],
            outfits: [],
            references: [],
          },
        });
      case '/api/uploads':
        uploads++;
        return route.fulfill({ json: { imageUrl: '/api/images/qa-person' } });
      case '/api/experience':
        return route.fulfill({ json: { draft: [], recent: [], preferences: { region: 'US' } } });
      case '/api/discovery':
        return route.fulfill({ json: { detections: [], enabled: true } });
      case '/api/try-on':
        attempts++;
        expect(request.postDataJSON()).toEqual({
          agent: 'try-on',
          photoUrl: '/api/images/qa-person',
          garmentIds: ['jacket'],
          consent: true,
        });
        return attempts === 1
          ? route.fulfill({ status: 503, json: { error: 'Check again in a moment.' } })
          : route.fulfill({ json: { imageUrl: '/api/images/qa-preview' } });
      case '/api/images/qa-preview':
        return route.fulfill({ contentType: 'image/webp', body: result });
      default:
        return route.fulfill({ json: {} });
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'My Closet', exact: true }).click();
  await page.getByText('More closet tools').click();
  await page.getByRole('button', { name: 'Outfit canvas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open try-on' })).toBeDisabled();
  await page.getByRole('region', { name: 'Virtual try-on' }).scrollIntoViewIfNeeded();
  await page
    .getByLabel('Add pieces to canvas')
    .getByRole('button', { name: 'Denim jacket' })
    .click();
  await page.getByRole('button', { name: 'Open try-on' }).click();
  const dialog = page.getByRole('dialog', { name: 'Try it on me' });
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'qa-photo.png',
    mimeType: 'image/png',
    buffer: original,
  });
  await expect(dialog.getByAltText('Your original photo')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Create preview' })).toBeDisabled();
  expect(uploads).toBe(0);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Create preview' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Check again in a moment.');
  await dialog.getByRole('button', { name: 'Check preview again' }).click();
  await expect(
    dialog.getByAltText('AI preview of you wearing the selected outfit'),
  ).toHaveJSProperty('naturalWidth', 64);
  expect(uploads).toBe(1);
  expect(attempts).toBe(2);
  await expect(dialog.getByRole('button', { name: 'Preview', exact: true })).toBeFocused();
  await expect(dialog.getByAltText('Your original photo')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Compare original' }).click();
  await expect(dialog.getByAltText('Your original photo')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Download preview' })).toHaveAttribute(
    'download',
    'fitstalker-try-on.webp',
  );
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Open try-on' }).click();
  await expect(dialog.getByText('Try-on preview', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});
