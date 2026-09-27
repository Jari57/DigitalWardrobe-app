import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['admin-database.spec.ts'],
  workers: 1,
  retries: 0,
  reporter: 'list',
});
