import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

test('Blind Fit preserves locks, explains a real AI outfit, reuses it and hands it to canvas', async ({ page, context }) => {
  test.skip(process.env.LIVE_STYLIST !== 'true', 'Opt-in paid provider acceptance check');
  const username = `qa_${randomBytes(7).toString('hex')}`;
  const password = randomBytes(20).toString('hex');
  const headers = { Origin: 'http://localhost:3100' };
  expect((await context.request.post('/api/auth', { headers, data: { action: 'signup', username, password } })).status()).toBe(201);
  try {
    const photo = await sharp({ create: { width: 80, height: 100, channels: 4, background: '#ffffff' } }).png().toBuffer();
    for (const [name, category, color] of [['White cotton tee', 'tops', '#ffffff'], ['Black straight jeans', 'bottoms', '#111111'], ['White sneakers', 'shoes', '#ffffff']]) {
      const upload = await context.request.post('/api/uploads', { headers, multipart: { file: { name: 'qa.png', mimeType: 'image/png', buffer: photo } } });
      expect(upload.status()).toBe(201);
      expect((await context.request.post('/api/garments', { headers, data: { name, category, color, imageUrl: (await upload.json()).imageUrl, brand: '', price: null } })).status()).toBe(201);
    }
    const { garments } = await (await context.request.get('/api/wardrobe')).json();
    const input = { agent: 'stylist', candidateIds: garments.map((g: {id:string}) => g.id), lockedIds: [], occasion: 'Everyday', aesthetic: 'Minimal' };
    expect((await context.request.post('/api/stylist', { headers, data: { ...input, candidateIds: [] } })).status()).toBe(400);
    expect((await context.request.post('/api/stylist', { headers, data: { ...input, lockedIds: ['unavailable'] } })).status()).toBe(400);
    expect((await context.request.post('/api/stylist', { headers, data: { ...input, candidateIds: ['unavailable'] } })).status()).toBe(404);
    const stranger = await context.browser()!.newContext({ baseURL: 'http://localhost:3100' });
    try {
      expect((await stranger.request.post('/api/auth', { headers, data: { action: 'signup', username: `qa_${randomBytes(7).toString('hex')}`, password } })).status()).toBe(201);
      expect((await stranger.request.post('/api/stylist', { headers, data: input })).status()).toBe(404);
    } finally {
      await stranger.request.delete('/api/account', { headers, data: { password } });
      await stranger.close();
    }
    await page.goto('/');
    await page.locator('.challenge-banner').click();
    await page.getByRole('button', { name: 'Reveal my fit', exact: true }).click();
    const lockedName = await page.locator('.blind-grid button').first().innerText();
    await page.locator('.blind-grid button').first().click();
    await page.getByRole('combobox', { name: 'Occasion', exact: true }).selectOption('Content shoot');
    await page.getByRole('combobox', { name: 'Style', exact: true }).selectOption('Streetwear');
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/api/stylist') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Style with AI', exact: true }).click();
    const response = await responsePromise;
    expect(response.status(), await response.text()).toBe(200);
    const result = await response.json();
    expect(result.garmentIds.length).toBeGreaterThan(0);
    expect(result.garmentIds.every((id: string) => input.candidateIds.includes(id))).toBe(true);
    await expect(page.locator('.blind-grid .locked')).toHaveText(lockedName);
    await expect(page.getByText('Why this works', { exact: true })).toBeVisible();
    const repeated = await context.request.post('/api/stylist', { headers, data: response.request().postDataJSON() });
    expect(repeated.status()).toBe(200);
    expect((await repeated.json()).id).toBe(result.id);
    await page.screenshot({ path: '../stylist-mobile.png', fullPage: true });
    // A failed provider/allowance response must preserve the accepted selection.
    const names = await page.locator('.blind-grid button').allTextContents();
    await page.route('**/api/stylist', route => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'Today’s AI allowance is used up.' }) }));
    await page.getByRole('button', { name: 'Style with AI', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('allowance');
    expect(await page.locator('.blind-grid button').allTextContents()).toEqual(names);
    await page.getByRole('button', { name: 'Style this on canvas', exact: true }).click();
    await expect(page.locator('.canvas-piece')).toHaveCount(result.garmentIds.length);
  } finally {
    test.setTimeout(test.info().timeout + 15_000);
    expect((await context.request.delete('/api/account', { headers, data: { password } })).status()).toBe(200);
  }
});
