import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

test('real inspiration matches owned pieces, saves editable pairings and hands off to canvas', async ({
  page,
  context,
}) => {
  test.skip(!process.env.LIVE_SPOTTER_PHOTO, 'Opt-in real photo provider evaluation');
  const password = randomBytes(20).toString('hex'),
    headers = { Origin: 'http://localhost:3100' };
  expect(
    (
      await context.request.post('/api/auth', {
        headers,
        data: { action: 'signup', username: `qa_${randomBytes(7).toString('hex')}`, password },
      })
    ).status(),
  ).toBe(201);
  try {
    const photo = await readFile(process.env.LIVE_SPOTTER_PHOTO!);
    const upload = await context.request.post('/api/uploads', {
      headers,
      multipart: { file: { name: 'inspiration.jpg', mimeType: 'image/jpeg', buffer: photo } },
    });
    expect(upload.status()).toBe(201);
    const { imageUrl } = await upload.json();
    const garmentResponse = await context.request.post('/api/garments', {
      headers,
      data: {
        name: 'Blue chambray button-down shirt',
        category: 'tops',
        brand: '',
        color: '#6a91b5',
        price: null,
        imageUrl,
      },
    });
    expect(garmentResponse.status()).toBe(201);
    const { garment } = await garmentResponse.json();
    const referenceResponse = await context.request.post('/api/references', {
      headers,
      data: { name: 'Shirt inspiration', imageUrl, garmentIds: [] },
    });
    expect(referenceResponse.status()).toBe(201);
    const { reference } = await referenceResponse.json();
    const input = {
      agent: 'spotter',
      imageId: imageUrl.split('/').pop(),
      candidateIds: [garment.id],
    };
    const stranger = await context.browser()!.newContext({ baseURL: 'http://localhost:3100' });
    try {
      expect(
        (
          await stranger.request.post('/api/auth', {
            headers,
            data: { action: 'signup', username: `qa_${randomBytes(7).toString('hex')}`, password },
          })
        ).status(),
      ).toBe(201);
      expect((await stranger.request.post('/api/spotter', { headers, data: input })).status()).toBe(
        404,
      );
      expect(
        (
          await stranger.request.patch(`/api/references/${reference.id}`, {
            headers,
            data: { garmentIds: [garment.id] },
          })
        ).status(),
      ).toBe(404);
    } finally {
      await stranger.request.delete('/api/account', { headers, data: { password } });
      await stranger.close();
    }
    await page.goto('/');
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Spotter', exact: true })
      .click();
    await page.getByRole('button', { name: 'Recreate this look', exact: true }).click();
    const responsePromise = page.waitForResponse((r) => r.url().endsWith('/api/spotter'));
    await page.getByRole('button', { name: 'Match my closet with AI', exact: true }).click();
    const response = await responsePromise;
    expect(response.status(), await response.text()).toBe(200);
    const result = await response.json();
    expect(
      result.elements.some((e: { garmentId: string | null }) => e.garmentId === garment.id),
    ).toBe(true);
    expect(
      result.elements.every(
        (e: { garmentId: string | null }) => e.garmentId === null || e.garmentId === garment.id,
      ),
    ).toBe(true);
    const again = await context.request.post('/api/spotter', { headers, data: input });
    expect(again.status()).toBe(200);
    expect((await again.json()).id).toBe(result.id);
    await expect(page.getByRole('region', { name: 'Suggested closet matches' })).toBeVisible();
    await page.screenshot({ path: '../spotter-owned-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Save and style on canvas', exact: true }).click();
    await expect(page.locator('.canvas-piece')).toHaveCount(1);
    const saved = await (await context.request.get('/api/wardrobe')).json();
    expect(saved.references.find((r: { id: string }) => r.id === reference.id).garmentIds).toEqual([
      garment.id,
    ]);
    expect(
      (
        await context.request.patch(`/api/references/${reference.id}`, {
          headers,
          data: { garmentIds: ['unavailable'] },
        })
      ).status(),
    ).toBe(400);
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Spotter', exact: true })
      .click();
    await page.getByRole('button', { name: 'Recreate this look', exact: true }).click();
    // Explicit fixture exercises the no-match shopping handoff without another paid generation.
    await page.route('**/api/spotter', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          elements: [
            {
              description: 'Missing jacket',
              garmentId: null,
              explanation: 'No jacket in this closet.',
            },
          ],
          limitations: [],
        }),
      }),
    );
    await page.getByRole('button', { name: 'Match my closet with AI', exact: true }).click();
    await page.getByRole('button', { name: 'Find missing pieces to buy', exact: true }).click();
    await expect(page.getByAltText('Selected inspiration for shopping')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Identify clothes', exact: true })).toBeEnabled();
    // Empty image: a real provider must not invent outfit elements.
    const blank = await sharp({
      create: { width: 80, height: 100, channels: 4, background: '#dddddd' },
    })
      .png()
      .toBuffer();
    const emptyUpload = await context.request.post('/api/uploads', {
      headers,
      multipart: { file: { name: 'blank.png', mimeType: 'image/png', buffer: blank } },
    });
    expect(emptyUpload.status()).toBe(201);
    const empty = await context.request.post('/api/spotter', {
      headers,
      data: {
        ...input,
        imageId: (await emptyUpload.json()).imageUrl.split('/').pop(),
        candidateIds: [],
      },
    });
    expect(empty.status(), await empty.text()).toBe(200);
    expect((await empty.json()).elements).toEqual([]);
  } finally {
    test.setTimeout(test.info().timeout + 15_000);
    expect(
      (await context.request.delete('/api/account', { headers, data: { password } })).status(),
    ).toBe(200);
  }
});
