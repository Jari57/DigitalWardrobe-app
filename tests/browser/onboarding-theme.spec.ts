import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';

test('creator quick start is skippable and themes persist while system mode follows device', async ({
  page,
  context,
}) => {
  const password = randomBytes(20).toString('hex');
  const headers = { Origin: 'http://localhost:3100' };
  expect(
    (
      await context.request.post('/api/auth', {
        headers,
        data: { action: 'signup', username: `qa_${randomBytes(7).toString('hex')}`, password },
      })
    ).status(),
  ).toBe(201);
  try {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Find clothes from a screenshot.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Upload screenshot', exact: true }),
    ).toBeInViewport();
    await page.getByRole('navigation').getByRole('button', { name: 'Closet', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('region', { name: 'Creator quick start' })).toBeVisible();
    await page.getByRole('button', { name: 'Streetwear', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Streetwear', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Add my first photo', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.locator('.challenge-banner').click();
    await expect(page.getByText('Add pieces to your closet to start the challenge.')).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.screenshot({ path: '../onboarding-dark.png', fullPage: true });
    await page.getByRole('button', { name: 'Theme: system. Switch to light', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await page.getByRole('navigation').getByRole('button', { name: 'Closet', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('region', { name: 'Creator quick start' })).toBeVisible();
    await page.screenshot({ path: '../onboarding-light.png', fullPage: true });
    await page.getByRole('button', { name: 'Theme: light. Switch to dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Theme: dark. Switch to system', exact: true }).click();
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Creator quick start' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Creator quick start', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Creator quick start' })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    test.setTimeout(test.info().timeout + 15_000);
    expect(
      (await context.request.delete('/api/account', { headers, data: { password } })).status(),
    ).toBe(200);
  }
});
