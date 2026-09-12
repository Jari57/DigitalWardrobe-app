import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { groundedListings, rankingSchema, safeShoppingUrl } from '../../src/lib/discovery';
import sharp from 'sharp';

test('discovery UI reviews sourced results, saves to the real closet, and shows provider limits', async ({ page, context }) => {
  const username = `qa_${randomBytes(7).toString('hex')}`;
  const password = randomBytes(20).toString('hex');
  const headers = { Origin: 'http://localhost:3100' };
  expect((await context.request.post('/api/auth', { headers, data: { action: 'signup', username, password } })).status()).toBe(201);
  try {
    // Provider fixtures are confined to browser tests; uploads and saving use the real API/database.
    const photo = await sharp({ create: { width: 240, height: 320, channels: 3, background: '#6489a1' } }).png().toBuffer();
    let detection: Record<string, unknown> | null = null;
    let limited = false;
    await page.route('**/api/discovery', async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { enabled: true, detections: detection ? [detection] : [] } });
      const body = route.request().postDataJSON();
      if (limited) return route.fulfill({ status: 429, json: { error: 'The AI provider is at its usage limit.' } });
      if (body.agent === 'detect') {
        detection = { id: 'fixture-scan', imageUrl: `/api/images/${body.imageId}`, items: [{ name: 'Blue denim shirt', category: 'tops', color: '#6489a1', visibleBrand: null, description: 'Blue button-up shirt.', uncertainty: 'Brand is not visible.' }], note: 'Review the detected details.' };
        return route.fulfill({ json: detection });
      }
      return route.fulfill({ json: { id: 'fixture-search', country: body.country, searchedAt: new Date().toISOString(), note: 'Exact identity is unverified.', listings: [{ title: 'Denim shirt', url: 'https://retailer.example/product/shirt', retailer: 'retailer.example', match: 'similar', reason: 'Similar color and collar.' }] } });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Spotter', exact: true }).click();
    await page.getByLabel('Clothing or outfit photo', { exact: true }).setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: photo });
    await page.getByRole('button', { name: 'Identify clothes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Blue denim shirt', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Find where to buy', exact: true }).click();
    await expect(page.locator('.shopping-link')).toHaveAttribute('href', 'https://retailer.example/product/shirt');
    await expect(page.getByText('Similar alternative', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'I own this · save', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Piece name').fill('Reviewed blue shirt');
    await page.getByRole('dialog').getByRole('button', { name: 'Save piece', exact: true }).click();
    await expect(page.getByText('Piece saved to your closet.', { exact: true })).toBeVisible();
    expect((await (await context.request.get('/api/wardrobe')).json()).garments[0].name).toBe('Reviewed blue shirt');
    await page.reload();
    await page.getByRole('button', { name: 'Spotter', exact: true }).click();
    await page.getByLabel('Recent scans').selectOption('fixture-scan');
    limited = true;
    await page.getByRole('button', { name: 'Find where to buy', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Clothing discovery' }).getByRole('alert')).toHaveText('The AI provider is at its usage limit.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '../discovery-ui-fixture.png', fullPage: true });
    // These requests bypass browser fixtures and exercise server-side validation before any AI call.
    expect((await context.request.post('/api/discovery', { headers, data: { agent: 'detect', imageId: 'not-owned' } })).status()).toBe(404);
    expect((await context.request.post('/api/discovery', { headers, data: { agent: 'shop', detectionId: 'not-owned', itemIndex: 0, country: 'US' } })).status()).toBe(404);
    expect((await context.request.post('/api/discovery', { data: { agent: 'detect', imageId: 'not-owned' } })).status()).toBe(403);
  } finally { await context.request.delete('/api/account', { headers, data: { password } }); }
});

test('shopping results reject unsafe and fabricated links and unsupported exact claims', () => {
  for (const url of ['javascript:alert(1)', 'http://shop.com/a', 'https://127.0.0.1/a', 'https://user:pass@shop.com/a', 'https://localhost/a', 'https://foo.internal/a']) expect(safeShoppingUrl(url)).toBeNull();
  const ranking = rankingSchema.parse({ listings: [
    { sourceIndex: 0, reason: 'Similar blue shirt', match: 'possible-exact' },
    { sourceIndex: 0, reason: 'Duplicate', match: 'similar' },
    { sourceIndex: 7, reason: 'Invented source', match: 'similar' },
  ], note: '' });
  const result = groundedListings(ranking, [{ title: 'Blue denim shirt', url: 'https://retailer.example/shirt' }], null);
  expect(result).toHaveLength(1);
  expect(result[0].match).toBe('similar');
  expect(result[0].url).toBe('https://retailer.example/shirt');
});

test('real photo → real detection → sourced shopping links → saved closet piece', async ({ page, context, browser }) => {
  test.skip(!process.env.LIVE_DISCOVERY_PHOTO, 'Opt-in live provider test: requires a local clothing photo and credits.');
  test.setTimeout(180_000);
  const username = `qa_${randomBytes(7).toString('hex')}`;
  const password = randomBytes(20).toString('hex');
  const headers = { Origin: 'http://localhost:3100' };
  const signup = await context.request.post('/api/auth', { headers, data: { action: 'signup', username, password } });
  expect(signup.status()).toBe(201);
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Spotter', exact: true }).click();
    await page.getByLabel('Clothing or outfit photo', { exact: true }).setInputFiles(process.env.LIVE_DISCOVERY_PHOTO!);
    const scanResponse = page.waitForResponse(response => response.url().endsWith('/api/discovery') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Identify clothes', exact: true }).click();
    const scan = await scanResponse;
    expect(scan.status(), await scan.text()).toBe(200);
    const detected = await scan.json();
    expect(detected.items.length).toBeGreaterThan(0);
    expect(detected.items[0].name).toMatch(/shirt|denim/i);
    const searchResponse = page.waitForResponse(response => response.url().endsWith('/api/discovery') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Find where to buy', exact: true }).first().click();
    const search = await searchResponse;
    expect(search.status(), await search.text()).toBe(200);
    const shopping = await search.json();
    expect(shopping.listings.length).toBeGreaterThan(0);
    await expect(page.locator('.shopping-link').first()).toBeVisible();
    expect(shopping.listings.every((listing: {url: string}) => safeShoppingUrl(listing.url))).toBe(true);
    console.log(JSON.stringify({ detected: detected.items.map((item: {name: string}) => item.name), listings: shopping.listings }));
    // Retry identical actions: persisted responses, not another paid generation.
    const repeat = await context.request.post('/api/discovery', { headers, data: { agent: 'shop', detectionId: detected.id, itemIndex: 0, country: 'US' } });
    expect((await repeat.json()).id).toBe(shopping.id);
    const outsider = await browser.newContext();
    try {
      expect((await outsider.request.get('http://localhost:3100/api/discovery')).status()).toBe(401);
      await outsider.request.post('http://localhost:3100/api/auth', { headers, data: { action: 'signup', username: `${username}_b`, password } });
      expect((await outsider.request.post('http://localhost:3100/api/discovery', { headers, data: { agent: 'shop', detectionId: detected.id, itemIndex: 0, country: 'US' } })).status()).toBe(404);
      expect((await outsider.request.post('http://localhost:3100/api/discovery', { headers, data: { agent: 'detect', imageId: detected.imageUrl.split('/').pop() } })).status()).toBe(404);
    } finally { await outsider.request.delete('http://localhost:3100/api/account', { headers, data: { password } }); await outsider.close(); }
    await page.screenshot({ path: '../discovery-flow.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'I own this · save', exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save piece', exact: true }).click();
    await expect(page.getByText('Piece saved to your closet.', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Spotter', exact: true }).click();
    await page.getByLabel('Recent scans').selectOption(detected.id);
    await expect(page.locator('.discovery-item')).toHaveCount(detected.items.length);
    const wardrobe = await context.request.get('/api/wardrobe');
    expect((await wardrobe.json()).garments).toHaveLength(1);
  } finally { await context.request.delete('/api/account', { headers, data: { password } }); }
});

