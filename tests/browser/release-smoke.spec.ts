import { test, expect } from '@playwright/test';

test('release is healthy, billing stays off and anonymous admin access is denied', async ({
  request,
}) => {
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ ok: true, database: 'ready', billing: 'off' });
  const evidence = await request.get('/api/admin/evidence');
  expect(evidence.status()).toBe(401);
  const admin = await request.get('/admin', { maxRedirects: 0 });
  expect(admin.status()).toBe(307);
  expect(admin.headers().location).toBe('/login');
});

for (const width of [390, 1440]) {
  test(`release upload shortcut and guide work at ${width}px without an AI request`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const unexpected: string[] = [];
    const errors: string[] = [];
    // Prevent the smoke check from spending money or writing user data even on a regression.
    await page.route('**/api/**', async (route) => {
      if (!['GET', 'HEAD'].includes(route.request().method())) {
        if (!route.request().url().endsWith('/api/traffic'))
          unexpected.push(new URL(route.request().url()).pathname);
        await route.fulfill({ status: 204 });
      } else await route.continue();
    });
    page.on('pageerror', (error) => errors.push(error.name));
    await page.goto('/');
    const upload = page.getByRole('button', { name: /Upload screenshot Find the pieces/ });
    await expect(upload).toBeVisible();
    const chooser = page.waitForEvent('filechooser');
    await upload.click();
    await chooser;
    await expect(page.getByRole('button', { name: 'Identify clothes', exact: true })).toHaveCount(
      0,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/how-it-works');
    await expect(page.getByRole('main')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    expect(unexpected).toEqual([]);
  });
}
