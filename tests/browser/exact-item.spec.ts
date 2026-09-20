import { test, expect } from '@playwright/test';
import { randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Ground truth stays in the evaluator. Only neutral-named image bytes go to the app.
// Official source: https://www.adidas.com/us/samba-og-shoes/B75806.html
// White / black / gum Samba OG, B75806. No corrections, source URL or SKU in requests.
test('known product image independently retrieves its exact official product code', async ({
  context,
}, testInfo) => {
  test.skip(
    !process.env.LIVE_EXACT_ITEM_PHOTO,
    'Opt-in known-item evaluation, two explicit AI actions.',
  );
  test.setTimeout(180_000);
  const api = context.request;
  const headers = { Origin: 'http://localhost:3100' };
  const password = randomBytes(20).toString('hex');
  const signup = await api.post('/api/auth', {
    headers,
    data: { action: 'signup', username: 'qa_' + randomBytes(7).toString('hex'), password },
  });
  expect(signup.status()).toBe(201);
  const report: Record<string, unknown> = {
    case: 'samba-b75806-v1',
    expectedProduct: 'B75806',
    expectedColor: 'Cloud White / Core Black / gum',
    source: 'https://www.adidas.com/us/samba-og-shoes/B75806.html',
    attempts: 1,
  };
  try {
    const bytes = await readFile(process.env.LIVE_EXACT_ITEM_PHOTO!);
    report.imageSha256 = createHash('sha256').update(bytes).digest('hex');
    const upload = await api.post('/api/uploads', {
      headers,
      multipart: { file: { name: 'input.jpg', mimeType: 'image/jpeg', buffer: bytes } },
    });
    expect(upload.status()).toBe(201);
    const imageId = (await upload.json()).imageUrl.split('/').pop();
    const started = Date.now();
    const scan = await api.post('/api/discovery', { headers, data: { agent: 'detect', imageId } });
    expect(scan.status(), await scan.text()).toBe(200);
    const detection = await scan.json();
    report.detection = detection;
    const itemIndex = detection.items.findIndex(
      (item: { category: string }) => item.category === 'shoes',
    );
    expect(itemIndex).toBeGreaterThanOrEqual(0);
    const search = await api.post('/api/discovery', {
      headers,
      data: { agent: 'shop', detectionId: detection.id, itemIndex, country: 'US' },
    });
    expect(search.status(), await search.text()).toBe(200);
    const shopping = await search.json();
    report.shopping = shopping;
    report.elapsedMs = Date.now() - started;
    const exact = shopping.listings.filter((listing: { url: string }) => {
      const url = new URL(listing.url);
      return (
        ['adidas.com', 'www.adidas.com'].includes(url.hostname) &&
        /^\/us\/.*\/B75806\.html$/i.test(url.pathname)
      );
    });
    report.exactProductRetrieved = exact.length > 0;
    expect(
      exact.length,
      'Expected the independently sourced official B75806 product, not just another Samba',
    ).toBeGreaterThan(0);
  } finally {
    await testInfo.attach('known-product-evaluation', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
    console.log(JSON.stringify(report));
    expect((await api.delete('/api/account', { headers, data: { password } })).status()).toBe(200);
  }
});
