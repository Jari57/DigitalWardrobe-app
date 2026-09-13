import { test, expect } from '@playwright/test';
import sharp from 'sharp';
test('installed-worker share handoff stays local and waits for explicit identification', async ({
  page,
  request,
}) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.share_target.action).toBe('/share-target');
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  let uploads = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/api\/(uploads|discovery)/.test(r.url())) uploads++;
  });
  const bytes = Array.from(
    await sharp({ create: { width: 40, height: 60, channels: 3, background: '#665544' } })
      .png()
      .toBuffer(),
  );
  await page.evaluate((bytes) => {
    const form = document.createElement('form');
    form.action = '/share-target';
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    const input = document.createElement('input');
    input.type = 'file';
    input.name = 'screenshot';
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], 'outfit.png', { type: 'image/png' }));
    input.files = transfer.files;
    form.append(input);
    document.body.append(form);
    form.submit();
  }, bytes);
  await expect(page.getByAltText('Your selected screenshot')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Identify clothes', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('share')).toBe(false);
  expect(uploads).toBe(0);
  const stored = await page.evaluate(async () => {
    const urls = [];
    for (const key of await caches.keys())
      for (const r of await (await caches.open(key)).keys()) urls.push(new URL(r.url).pathname);
    return urls;
  });
  expect(stored.every((url) => url.startsWith('/icons/') || url === '/offline.html')).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Upload screenshot', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.action = '/share-target';
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    document.body.append(form);
    form.submit();
  });
  await expect(
    page.getByRole('region', { name: 'Clothing discovery' }).getByRole('alert'),
  ).toContainText('Upload your screenshot');
  expect(uploads).toBe(0);
});
