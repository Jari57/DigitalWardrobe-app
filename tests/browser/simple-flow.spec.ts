import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function fixture(page: Page, signedIn = false, populated = false) {
  const calls = { paid: 0, auth: 0 };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (
      ['/api/stylist', '/api/creator', '/api/discovery'].includes(path) &&
      route.request().method() === 'POST'
    ) {
      calls.paid++;
      return route.fulfill({
        status: 500,
        json: { error: 'Paid calls are forbidden in this UX check.' },
      });
    }
    if (path === '/api/auth') {
      signedIn = true;
      calls.auth++;
    }
    const garments = populated
      ? [
          {
            id: 'shirt',
            name: 'My shirt',
            category: 'tops',
            color: 'blue',
            brand: '',
            imageUrl: '/icons/icon-192.png',
            price: null,
            wearCount: 0,
          },
        ]
      : [];
    const body =
      path === '/api/session'
        ? { user: signedIn ? { id: 'fixture', username: 'fixture' } : null }
        : path === '/api/wardrobe'
          ? { garments, outfits: [], references: [] }
          : path === '/api/discovery'
            ? { enabled: true, detections: [], searches: [] }
            : path === '/api/experience'
              ? { draft: [], recent: [] }
              : {};
    await route.fulfill({ json: body });
  });
  return calls;
}

for (const width of [320, 390, 1440]) {
  test(`upload is the first visible task, with three navigation choices at ${width}px`, async ({
    page,
  }) => {
    const calls = await fixture(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('wardrobe-theme', 'light'));
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('button')).toHaveText(['Find', 'My Closet', 'Saved']);
    const upload = page.getByRole('button', { name: 'Upload photo', exact: true });
    await expect(upload).toBeInViewport({ ratio: 1 });
    const button = (await upload.boundingBox())!;
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.y + button.height).toBeLessThan(
      (await nav.boundingBox())!.y > 300 ? (await nav.boundingBox())!.y : 844,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/simple-find-${width}-light.png` });
    await page.getByRole('button', { name: 'Theme: light. Switch to dark' }).click();
    await expect(upload).toHaveCSS('background-color', 'rgb(230, 218, 198)');
    await expect(upload).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/simple-find-${width}-dark.png` });
    expect(calls.paid).toBe(0);
  });
}

test('style entry explains the empty closet and resumes adding after sign-in', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Style my clothes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Start your closet' })).toBeVisible();
  await expect(page.getByLabel('Search closet')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Closet stats' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add your first item' }).click();
  const auth = page.getByRole('dialog');
  await expect(auth).toContainText('the add-item form opens next');
  await auth.getByLabel('Username', { exact: true }).fill('fixture');
  await auth.getByLabel('Password', { exact: true }).fill('fixture-password');
  await auth.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add to your closet' })).toBeVisible();
  expect(calls.auth).toBe(1);
  expect(calls.paid).toBe(0);
});

test('dismissing add-item sign-in clears the pending action', async ({ page }) => {
  await fixture(page);
  await page.goto('/');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'My Closet', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add your first item' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const auth = page.getByRole('dialog');
  await auth.getByLabel('Username', { exact: true }).fill('fixture');
  await auth.getByLabel('Password', { exact: true }).fill('fixture-password');
  await auth.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account settings' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('populated closet keeps tools available and styles without a second sign-in', async ({
  page,
}) => {
  const calls = await fixture(page, true, true);
  await page.goto('/');
  await page.getByRole('button', { name: 'Style my clothes', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Style my clothes' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('button', { name: 'Outfit canvas' })).not.toBeVisible();
  await page.getByText('More closet tools', { exact: true }).click();
  await page.getByRole('button', { name: 'Closet stats' }).click();
  await expect(
    page.getByRole('navigation').getByRole('button', { name: 'My Closet' }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: '← Back to My Closet' }).click();
  await page.getByText('Search & filter items', { exact: true }).click();
  await page.getByLabel('Search closet').fill('missing');
  await expect(page.getByRole('heading', { name: 'No pieces found' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('button', { name: 'Edit My shirt' })).toBeVisible();
  expect(calls.auth).toBe(0);
  expect(calls.paid).toBe(0);
});
