import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

test('closet add edit search filter and delete work through the UI', async ({ page, context }) => {
  const password = randomBytes(20).toString('hex');
  const headers = { Origin: process.env.TEST_BASE_URL || 'http://localhost:3101' };
  const result = await context.request.post('/api/auth', {
    headers,
    data: { action: 'signup', username: `qa_closet_${randomBytes(6).toString('hex')}`, password },
  });
  expect(result.status()).toBe(201);
  try {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('button', { name: 'Closet', exact: true })
      .click();
    await page.getByRole('button', { name: 'Add your first piece', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const buffer = await sharp({
      create: { width: 100, height: 150, channels: 3, background: '#334455' },
    })
      .png()
      .toBuffer();
    await dialog
      .getByLabel('Photo', { exact: true })
      .setInputFiles({ name: 'qa.png', mimeType: 'image/png', buffer });
    await dialog.getByLabel('Piece name', { exact: true }).fill('QA navy shirt');
    await dialog.getByRole('button', { name: 'Save piece' }).click();
    await expect(page.getByRole('button', { name: 'Edit QA navy shirt' })).toBeVisible();
    await page.getByLabel('Search closet').fill('not-in-closet');
    await expect(page.getByRole('heading', { name: 'No pieces found' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByRole('button', { name: 'Edit QA navy shirt' }).click();
    await dialog.getByLabel('Piece name', { exact: true }).fill('QA evening shirt');
    await dialog.getByRole('button', { name: 'Save piece' }).click();
    await expect(page.getByRole('button', { name: 'Edit QA evening shirt' })).toBeVisible();
    await page.reload();
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('button', { name: 'Closet', exact: true })
      .click();
    await page.getByRole('button', { name: 'Edit QA evening shirt' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete piece', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Add your first piece', exact: true }),
    ).toBeVisible();
  } finally {
    expect(
      (await context.request.delete('/api/account', { headers, data: { password } })).status(),
    ).toBe(200);
  }
});
