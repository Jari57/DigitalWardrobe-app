import { test, expect } from '@playwright/test';
test('PWA caches only public assets and returns a private-data-free offline page', async ({
  page,
  context,
  request,
}) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate(() => fetch('/api/session'));
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys())
        urls.push(new URL(request.url).pathname);
    return urls;
  });
  expect(cached.sort()).toEqual(
    [
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/maskable-512.png',
      '/offline.html',
    ].sort(),
  );
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your wardrobe is safe.' })).toBeVisible();
  await expect(page.getByText(/Private wardrobe content/)).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('link', { name: 'Try connecting again' }).click();
  await expect(page.getByRole('heading', { name: 'Wardrobe.' })).toBeVisible();
  // A distinct script URL installs a new worker for this isolated test scope.
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js?update-test=1');
  });
  await expect(page.getByRole('button', { name: 'Reload for update' })).toBeVisible();
  await Promise.all([
    page.waitForEvent('domcontentloaded'),
    page.getByRole('button', { name: 'Reload for update' }).click(),
  ]);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.scriptURL.includes('update-test=1')),
    )
    .toBe(true);
});
