import type { Page } from '@playwright/test';

export async function openStyleIdeas(page: Page) {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Find', exact: true })
    .click();
  await page.getByRole('button', { name: 'Browse style ideas', exact: true }).click();
}
