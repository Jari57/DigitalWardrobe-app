import { test, expect } from '@playwright/test';
import sharp from 'sharp';
test('screenshot onboarding leads to upload preview and explicit sign-in without AI calls', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  let paid = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/discovery')) paid++;
  });
  await page.goto('/');
  const start = page.getByRole('region', { name: 'Screenshot quick start' });
  await expect(start).toBeVisible();
  await expect(start.getByRole('button', { name: 'Find this fit' })).toBeInViewport();
  await page.screenshot({ path: '../screenshot-home-light.png' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: '../screenshot-home-dark.png' });
  await start.getByRole('button', { name: 'Find this fit' }).click();
  await expect(page.getByRole('heading', { name: 'Find this fit.' })).toBeVisible();
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
