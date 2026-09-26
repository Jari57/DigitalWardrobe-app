import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
test('saved-look creator supports edits, feedback, cache reuse and private ownership', async ({
  page,
  context,
  browser,
}) => {
  test.skip(process.env.LIVE_CREATOR !== 'true', 'Opt-in one real creator generation.');
  const headers = { Origin: 'http://localhost:3100' },
    password = randomBytes(20).toString('hex');
  const api = context.request;
  expect(
    (
      await api.post('/api/auth', {
        headers,
        data: { action: 'signup', username: `qa_${randomBytes(8).toString('hex')}`, password },
      })
    ).status(),
  ).toBe(201);
  try {
    const image = await sharp({
      create: { width: 150, height: 200, channels: 3, background: '#7890ab' },
    })
      .png()
      .toBuffer();
    const uploaded = await api.post('/api/uploads', {
      headers,
      multipart: { file: { name: 'shirt.png', mimeType: 'image/png', buffer: image } },
    });
    const { imageUrl } = await uploaded.json();
    const garment = await api.post('/api/garments', {
      headers,
      data: {
        name: 'Blue chambray shirt',
        brand: '',
        category: 'tops',
        color: '#7890ab',
        price: null,
        imageUrl,
      },
    });
    const id = (await garment.json()).garment.id;
    const saved = await api.post('/api/outfits', {
      headers,
      data: {
        name: 'Everyday blue',
        pieces: [{ garmentId: id, x: 20, y: 20, scale: 1, zIndex: 0 }],
      },
    });
    expect(saved.status()).toBe(201);
    const outfit = (await saved.json()).outfit;
    await page.goto('/');
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'My fits', exact: true })
      .click();
    await page.getByRole('button', { name: 'Create content', exact: true }).click();
    const resultPromise = page.waitForResponse((r) => r.url().endsWith('/api/creator'));
    await page.getByRole('button', { name: 'Draft with AI', exact: true }).click();
    const response = await resultPromise;
    expect(response.status(), await response.text()).toBe(200);
    const draft = await response.json();
    expect(draft.caption.length).toBeLessThanOrEqual(160);
    expect(draft.filmingSteps.length).toBeGreaterThan(0);
    await expect(page.getByLabel('Creator caption')).toHaveValue(draft.caption);
    await page.getByLabel('Creator caption').fill('My blue shirt, my way.');
    await page.getByRole('button', { name: 'Helpful', exact: true }).click();
    await expect(page.getByText('Feedback saved.', { exact: true })).toBeVisible();
    const repeat = await api.post('/api/creator', {
      headers,
      data: { agent: 'creator', outfitId: outfit.id, tone: 'playful' },
    });
    expect(await repeat.json()).toMatchObject({
      id: draft.id,
      feedback: 'helpful',
      caption: draft.caption,
    });
    const outsider = await browser.newContext({ baseURL: 'http://localhost:3100' });
    try {
      await outsider.request.post('/api/auth', {
        headers,
        data: { action: 'signup', username: `qa_${randomBytes(8).toString('hex')}`, password },
      });
      expect(
        (
          await outsider.request.post('/api/creator', {
            headers,
            data: { agent: 'creator', outfitId: outfit.id, tone: 'playful' },
          })
        ).status(),
      ).toBe(404);
      expect(
        (
          await outsider.request.post('/api/agent-feedback', {
            headers,
            data: { id: draft.id, feedback: 'helpful' },
          })
        ).status(),
      ).toBe(404);
    } finally {
      await outsider.request.delete('/api/account', { headers, data: { password } });
      await outsider.close();
    }
    expect(
      (
        await api.post('/api/agent-feedback', { headers, data: { id: draft.id, feedback: null } })
      ).status(),
    ).toBe(200);
    await page.screenshot({ path: '../creator-tools-mobile.png', fullPage: true });
  } finally {
    expect((await api.delete('/api/account', { headers, data: { password } })).status()).toBe(200);
  }
});
