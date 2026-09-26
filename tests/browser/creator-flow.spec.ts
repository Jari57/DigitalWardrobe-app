import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

test('mobile creator: Blind Fit locks, canvas export, saved look, and reference lifecycle', async ({
  page,
  context,
}) => {
  const username = `qa_${randomBytes(7).toString('hex')}`;
  const password = randomBytes(20).toString('hex');
  const headers = { Origin: 'http://localhost:3100' };
  const signup = await context.request.post('/api/auth', {
    headers,
    data: { action: 'signup', username, password },
  });
  expect(signup.status()).toBe(201);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const photo = await sharp({
      create: { width: 240, height: 320, channels: 4, background: '#c29b7f' },
    })
      .png()
      .toBuffer();
    for (const [name, category] of [
      ['QA top one', 'tops'],
      ['QA top two', 'tops'],
      ['QA jeans', 'bottoms'],
      ['QA shoes', 'shoes'],
    ]) {
      const upload = await context.request.post('/api/uploads', {
        headers,
        multipart: { file: { name: 'qa.png', mimeType: 'image/png', buffer: photo } },
      });
      expect(upload.status()).toBe(201);
      const { imageUrl } = await upload.json();
      const saved = await context.request.post('/api/garments', {
        headers,
        data: { name, category, imageUrl, brand: '', color: '#c29b7f', price: 0 },
      });
      expect(saved.status()).toBe(201);
    }
    await page.goto('/');
    await page.getByRole('button', { name: 'Account settings', exact: true }).click();
    await page.getByText('Shopping preferences', { exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: 'Shopping region', exact: true }),
    ).toBeEnabled();
    await page.getByRole('combobox', { name: 'Shopping region', exact: true }).selectOption('GB');
    await page.getByLabel('Budget per piece', { exact: true }).fill('80');
    await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption('GBP');
    await page.getByLabel('Preferred sizes', { exact: true }).fill('Tops M');
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await expect(
      page.getByText('Preferences saved. New searches use these defaults.'),
    ).toBeVisible();
    await page.screenshot({ path: '../mvp-preferences-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.getByRole('navigation').getByRole('button', { name: 'Closet', exact: true }).click();
    await expect(page.getByRole('button', { name: 'All (4)', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: /Style me For whatever/ }).click();
    await page.getByRole('button', { name: 'Surprise me without AI' }).click();
    await expect(page.locator('.blind-grid button')).toHaveCount(3);
    const lockedName = await page.locator('.blind-grid button').first().innerText();
    await page.locator('.blind-grid button').first().click();
    await page.getByRole('button', { name: 'Shuffle unlocked pieces' }).click();
    await expect(page.locator('.blind-grid .locked')).toHaveText(lockedName);
    await page.getByRole('button', { name: 'Edit on canvas' }).click();
    await expect(page.locator('.canvas-piece')).toHaveCount(3);
    await page.getByRole('button', { name: 'Save draft layout', exact: true }).click();
    await expect(
      page.getByText('Draft layout saved. Resume it from Spotter on any device.'),
    ).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Resume draft · 3 pieces', exact: true }).click();
    await expect(page.locator('.canvas-piece')).toHaveCount(3);
    await page.getByRole('button', { name: 'Theme: system. Switch to light' }).click();
    await page.getByRole('button', { name: 'Theme: light. Switch to dark' }).click();
    await page.screenshot({ path: '../mvp-draft-dark-mobile.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByLabel('Look name', { exact: true }).fill('QA creator look');
    await page.getByRole('button', { name: 'Save look', exact: true }).click();
    await expect(page.getByText('Look saved to your collection.')).toBeVisible();
    await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Your look is ready' })).toBeVisible();
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
    const download = await downloadEvent;
    expect(await download.failure()).toBeNull();
    const path = await download.path();
    const metadata = await sharp(path!).metadata();
    expect([metadata.width, metadata.height, metadata.format]).toEqual([1080, 1920, 'png']);
    // Ensure the exported photo is present, rather than just a blank caption template.
    const pixel = await sharp(path!)
      .extract({ left: 300, top: 400, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer();
    expect(pixel[0]).toBeLessThan(230);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    // Exercise the Web Share contract without posting to any external app.
    // The actual operating-system share sheet still requires a real-device check.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: ShareData) => {
          (window as unknown as { qaShare: unknown }).qaShare = {
            active: navigator.userActivation.isActive,
            type: data.files?.[0]?.type,
            text: data.text,
          };
          throw new DOMException('User canceled', 'AbortError');
        },
      });
    });
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await page.getByRole('button', { name: 'Share to an app', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Share to an app', exact: true })).toBeEnabled();
    expect(
      await page.evaluate(() => (window as unknown as { qaShare: unknown }).qaShare),
    ).toMatchObject({ active: true, type: 'image/png' });
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    });
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(
      page.getByText('Direct sharing isn’t supported here.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.reload();
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'My fits', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'QA creator look' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit a copy' }).click();
    await expect(page.locator('.canvas-piece')).toHaveCount(3);
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Spotter', exact: true })
      .click();
    await page.getByText('Recreate a look with my closet', { exact: true }).click();
    await page.getByRole('button', { name: 'Add inspiration', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('QA inspiration');
    await page
      .getByLabel('Inspiration photo')
      .setInputFiles({ name: 'reference.png', mimeType: 'image/png', buffer: photo });
    await page.getByRole('dialog').getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Save reference', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'QA inspiration' })).toBeVisible();
    await page.reload();
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Spotter', exact: true })
      .click();
    await page.getByText('Recreate a look with my closet', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'QA inspiration' })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete reference' }).click();
    await expect(page.getByRole('heading', { name: 'QA inspiration' })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    test.setTimeout(test.info().timeout + 15_000);
    const deleted = await context.request.delete('/api/account', { headers, data: { password } });
    expect(deleted.status()).toBe(200);
  }
});
