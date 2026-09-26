import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';

test('live feed controls persist likes, saves, hide undo and interests', async ({
  page,
  context,
}) => {
  const password = randomBytes(20).toString('hex');
  const headers = { Origin: process.env.TEST_BASE_URL || 'http://localhost:3101' };
  const signup = await context.request.post('/api/auth', {
    headers,
    data: { action: 'signup', username: `qa_feed_${randomBytes(6).toString('hex')}`, password },
  });
  expect(signup.status()).toBe(201);
  try {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('button', { name: 'For You', exact: true })
      .click();
    await expect(page.locator('.feed-card').first()).toBeVisible();
    const title = await page.locator('.feed-card h3').first().innerText();
    const card = page
      .locator('.feed-card')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await card.getByRole('button', { name: 'Like idea', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Unlike idea' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await card.getByRole('button', { name: 'Save idea', exact: true }).click();
    await page.getByRole('button', { name: 'Saved', exact: true }).click();
    await expect(card).toBeVisible();
    await page.reload();
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('button', { name: 'For You', exact: true })
      .click();
    await page.getByRole('button', { name: 'Saved', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Unsave idea' })).toBeVisible();
    await card.getByRole('button', { name: 'Unsave idea' }).click();
    await expect(card).toHaveCount(0);
    await page.getByRole('button', { name: 'Latest', exact: true }).click();
    const hideTitle = await page.locator('.feed-card h3').first().innerText();
    const hideCard = page
      .locator('.feed-card')
      .filter({ has: page.getByRole('heading', { name: hideTitle, exact: true }) });
    await hideCard.getByText('Why this?', { exact: true }).click();
    await hideCard.getByRole('button', { name: 'Not interested' }).click();
    await expect(hideCard).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(hideCard).toBeVisible();
    await page.getByRole('button', { name: 'Menswear', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Menswear', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Menswear', exact: true })).toBeEnabled();
    const saved = await context.request.get('/api/for-you');
    expect((await saved.json()).preferences.aesthetics).toContain('menswear');
    await page.getByRole('button', { name: 'Both', exact: true }).click();
    await page.getByRole('button', { name: 'For you', exact: true }).click();
    const before = await page.locator('.feed-card h3').first().innerText();
    await page.getByRole('button', { name: 'Refresh feed' }).click();
    await expect(page.getByRole('button', { name: 'Refresh feed' })).toBeEnabled({
      timeout: 45000,
    });
    await expect(page.locator('.feed-card h3').first()).not.toHaveText(before);
    await expect(
      page.getByRole('status').filter({ hasText: /new idea|different mix/ }),
    ).toBeVisible();
  } finally {
    expect(
      (await context.request.delete('/api/account', { headers, data: { password } })).status(),
    ).toBe(200);
  }
});
