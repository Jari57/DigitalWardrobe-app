import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
test('AI allowance is private and visible without starting generation', async ({
  page,
  context,
}) => {
  const headers = { Origin: 'http://localhost:3100' },
    password = randomBytes(20).toString('hex');
  expect((await context.request.get('/api/ai-allowance')).status()).toBe(401);
  await context.request.post('/api/auth', {
    headers,
    data: { action: 'signup', username: `qa_${randomBytes(8).toString('hex')}`, password },
  });
  try {
    const response = await context.request.get('/api/ai-allowance');
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(await response.json()).toMatchObject({ enabled: true, remaining: 10, limit: 10 });
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Closet', exact: true }).click();
    await expect(page.getByText(/AI: 10 of 10 daily actions left/)).toBeVisible();
  } finally {
    await context.request.delete('/api/account', { headers, data: { password } });
  }
});
