import { test, expect } from '@playwright/test';

test('resume is free and a piece shortcut searches once with errors kept to its region', async ({
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
    expect(route.request().postDataJSON()).toMatchObject({
      agent: 'shop',
      itemIndex: 1,
      country: 'US',
    });
    return route.fulfill({
      status: 503,
      json: { error: 'The provider is temporarily unavailable.' },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Continue your latest scan/ }).click();
  expect(searches).toBe(0);
  const trousers = page.locator('#detected-piece-1');
  await page.getByRole('button', { name: 'Shop Black trousers', exact: true }).click();
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
  await page.getByRole('button', { name: 'Save & style', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByText('Piece saved to your closet. Reload', { exact: false }),
  ).toBeVisible();
  expect(saves).toBe(1);
});

test('save and style refreshes once, locks the owned piece and does not generate automatically', async ({
  page,
}) => {
  let saves = 0,
    refreshes = 0,
    ai = 0;
  const garment = {
    id: 'saved-piece',
    name: 'Blue shirt',
    brand: '',
    category: 'tops',
    color: '#446688',
    price: null,
    imageUrl: '/icons/icon-192.png',
    wearCount: 0,
    createdAt: new Date().toISOString(),
  };
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { user: { id: 'fixture', username: 'fixture' } } }),
  );
  await page.route('**/api/wardrobe', (route) => {
    if (saves) refreshes++;
    return route.fulfill({
      json: { garments: saves ? [garment] : [], outfits: [], references: [] },
    });
  });
  await page.route('**/api/garments', (route) => {
    saves++;
    return route.fulfill({ json: { garment } });
  });
  await page.route('**/api/stylist', (route) => {
    ai++;
    return route.fulfill({ status: 500, json: { error: 'Unexpected generation' } });
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
  await page.getByRole('button', { name: /I own this/ }).click();
  await page.getByRole('button', { name: 'Save & style', exact: true }).click();
  const studio = page.getByRole('dialog', { name: 'Put a fit together' });
  await expect(studio).toBeVisible();
  await expect(studio.getByRole('button', { name: /Blue shirt/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(saves).toBe(1);
  expect(refreshes).toBe(1);
  expect(ai).toBe(0);
});
