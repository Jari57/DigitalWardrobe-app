import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test('guest screenshot survives sign-in and private scan state clears on sign-out', async ({
  page,
}) => {
  let signedIn = false;
  let providerCalls = 0;
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { user: signedIn ? { id: 'fixture-owner', username: 'owner' } : null } }),
  );
  await page.route('**/api/auth', (route) => {
    signedIn = route.request().postDataJSON().action !== 'signout';
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/wardrobe', (route) =>
    route.fulfill({ json: { garments: [], outfits: [], references: [] } }),
  );
  const buffer = await sharp({
    create: { width: 200, height: 300, channels: 3, background: '#887788' },
  })
    .png()
    .toBuffer();
  await page.route('**/api/images/private-fixture', (route) =>
    route.fulfill({ contentType: 'image/png', body: buffer }),
  );
  await page.route('**/api/discovery', (route) => {
    if (route.request().method() !== 'GET') {
      providerCalls++;
      return route.fulfill({ status: 500, json: { error: 'Unexpected provider call' } });
    }
    return route.fulfill({
      json: {
        enabled: true,
        detections: [
          {
            id: 'private-scan',
            imageUrl: '/api/images/private-fixture',
            note: 'Private scan note',
            items: [
              {
                name: 'Private silk shirt',
                category: 'tops',
                color: '#887788',
                description: 'Owner-only clothing description',
                visibleBrand: null,
                uncertainty: '',
              },
            ],
          },
        ],
      },
    });
  });
  await page.goto('/');
  await page.getByLabel('Clothing or outfit photo', { exact: true }).setInputFiles({
    name: 'screenshot.png',
    mimeType: 'image/png',
    buffer,
  });
  await page.getByRole('button', { name: 'Identify clothes', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Username', { exact: true }).fill('owner');
  await dialog.getByLabel('Password', { exact: true }).fill('fixture-password');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByAltText('Your selected screenshot')).toBeVisible();
  await page.getByLabel('Recent scans').selectOption('private-scan');
  await expect(
    page.getByRole('paragraph').filter({ hasText: 'Owner-only clothing description' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Account settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Upload screenshot', exact: true })).toBeVisible();
  await expect(page.getByLabel('Recent scans')).toHaveCount(0);
  await expect(page.getByText('Owner-only clothing description')).toHaveCount(0);
  await expect(page.getByAltText('Your scanned clothing photo')).toHaveCount(0);
  await expect(page.getByAltText('Your selected screenshot')).toHaveCount(0);
  expect(providerCalls).toBe(0);
});
test('screenshot onboarding leads to upload preview and explicit sign-in without AI calls', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  let paid = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/discovery')) paid++;
  });
  await page.goto('/');
  const start = page.getByRole('region', { name: 'Clothing discovery' });
  await expect(start).toBeVisible();
  await expect(start.getByRole('button', { name: 'Upload screenshot' })).toBeInViewport();
  await page.screenshot({ path: '../screenshot-home-light.png' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: '../screenshot-home-dark.png' });
  const chooser = page.waitForEvent('filechooser');
  await start.getByRole('button', { name: 'Upload screenshot' }).click();
  await chooser;
  await expect(page.getByRole('button', { name: 'Identify clothes', exact: true })).toHaveCount(0);
  const buffer = await sharp({
    create: { width: 200, height: 300, channels: 3, background: '#887788' },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel('Clothing or outfit photo', { exact: true })
    .setInputFiles({ name: 'screenshot.png', mimeType: 'image/png', buffer });
  await expect(page.getByAltText('Your selected screenshot')).toBeVisible();
  await page.getByRole('button', { name: 'Identify clothes', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByAltText('Your selected screenshot')).toHaveAttribute('src', /^blob:/);
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(paid).toBe(0);
});
