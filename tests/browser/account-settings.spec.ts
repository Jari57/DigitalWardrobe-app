import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';

test('signup preserves recovery code, password change invalidates old session, deletion requires confirmation', async ({ page, context }) => {
  const username = `qa_${randomBytes(7).toString('hex')}`;
  let password = randomBytes(20).toString('hex');
  const nextPassword = randomBytes(20).toString('hex');
  const headers = { Origin: 'http://localhost:3100' };
  let created = false, deleted = false;
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open account', exact: true }).click();
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    const response = page.waitForResponse(r => r.url().endsWith('/api/auth') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    expect((await response).status()).toBe(201); created = true;
    await expect(page.getByRole('heading', { name: 'Save your recovery code' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Save your recovery code' })).toBeVisible();
    await page.getByRole('button', { name: 'I saved my code' }).click();
    const oldCookies = (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; ');
    await page.getByRole('button', { name: 'Account settings', exact: true }).click();
    await page.getByLabel('Current password', { exact: true }).fill(password);
    await page.getByLabel('New password', { exact: true }).fill(nextPassword);
    await page.getByLabel('Repeat new password', { exact: true }).fill(nextPassword);
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Password updated.', { exact: false })).toBeVisible();
    password = nextPassword;
    // Explicit old cookie verifies that this was server-side revocation, not only UI state.
    const revoked = await context.request.get('/api/wardrobe', { headers: { Cookie: oldCookies } });
    expect(revoked.status()).toBe(401);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Open account', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Account settings', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Account settings', exact: true }).click();
    await page.getByRole('button', { name: 'Delete my account' }).click();
    await page.getByLabel('Confirm your password').fill('not-the-password');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Permanently delete account' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Password is incorrect.');
    await page.getByLabel('Confirm your password').fill(password);
    await page.getByRole('button', { name: 'Permanently delete account' }).click();
    await expect(page.getByRole('button', { name: 'Open account', exact: true })).toBeVisible();
    deleted = true;
    const signin = await context.request.post('/api/auth', { headers, data: { action: 'signin', username, password } });
    expect(signin.status()).toBe(401);
  } finally {
    if (created && !deleted) {
      await context.request.post('/api/auth', { headers, data: { action: 'signin', username, password } });
      const cleanup = await context.request.delete('/api/account', { headers, data: { password } });
      expect(cleanup.status()).toBe(200);
    }
  }
});
