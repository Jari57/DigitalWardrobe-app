import { test, expect } from '@playwright/test';

test('resume and piece navigation are free; failed searches stay with their piece and region', async ({
  page,
}) => {
  let searches = 0;
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { user: { id: 'fixture', username: 'fixture' } } }),
  );
  await page.route('**/api/wardrobe', (route) =>
    route.fulfill({ json: { garments: [], outfits: [], references: [] } }),
  );
  await page.route('**/api/discovery', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: {
          enabled: true,
          detections: [
            {
              id: 'scan',
              imageUrl: '/icons/icon-192.png',
              note: 'Review the details.',
              items: [
                {
                  name: 'Blue shirt',
                  description: 'Cotton shirt',
                  category: 'tops',
                  color: '#446688',
                  visibleBrand: null,
                  uncertainty: '',
                },
                {
                  name: 'Black trousers',
                  description: 'Wide-leg trousers',
                  category: 'bottoms',
                  color: '#222222',
                  visibleBrand: null,
                  uncertainty: '',
                },
              ],
            },
          ],
        },
      });
    searches++;
    return route.fulfill({
      status: 503,
      json: { error: 'The provider is temporarily unavailable.' },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Continue your latest scan/ }).click();
  await page.getByRole('link', { name: 'Black trousers', exact: true }).click();
  await expect(page).toHaveURL(/#detected-piece-1$/);
  expect(searches).toBe(0);
  const trousers = page.locator('#detected-piece-1');
  await trousers.getByRole('button', { name: 'Find where to buy' }).click();
  await expect(trousers.getByRole('alert')).toContainText(
    'The provider is temporarily unavailable.',
  );
  await expect(page.locator('#detected-piece-0').getByRole('alert')).toHaveCount(0);
  expect(searches).toBe(1);
  await page.getByLabel('Shopping region').selectOption('GB');
  await expect(trousers.getByRole('alert')).toHaveCount(0);
  await page.getByLabel('Shopping region').selectOption('US');
  await expect(trousers.getByRole('alert')).toBeVisible();
  expect(searches).toBe(1);
  await page.reload();
  await expect(page.getByRole('button', { name: /Continue your latest scan/ })).toBeVisible();
  expect(searches).toBe(1);
});

test('a committed closet save is not offered again when wardrobe refresh fails', async ({
  page,
}) => {
  let saves = 0;
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { user: { id: 'fixture', username: 'fixture' } } }),
  );
  await page.route('**/api/wardrobe', (route) =>
    saves
      ? route.fulfill({ status: 503, json: { error: 'Refresh unavailable' } })
      : route.fulfill({ json: { garments: [], outfits: [], references: [] } }),
  );
  await page.route('**/api/garments', (route) => {
    saves++;
    return route.fulfill({ json: { id: 'saved-piece' } });
  });
  await page.route('**/api/discovery', (route) =>
    route.fulfill({
      json: {
        enabled: true,
        detections: [
          {
            id: 'scan',
            imageUrl: '/icons/icon-192.png',
            note: '',
            items: [
              {
                name: 'Blue shirt',
                description: 'Cotton shirt',
                category: 'tops',
                color: '#446688',
                visibleBrand: null,
                uncertainty: '',
              },
            ],
          },
        ],
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Continue your latest scan/ }).click();
  await page.getByRole('button', { name: 'I own this · save' }).click();
  await page.getByRole('button', { name: 'Save piece', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByText('Piece saved to your closet. Reload', { exact: false }),
  ).toBeVisible();
  expect(saves).toBe(1);
});
