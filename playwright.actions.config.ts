import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['creator-flow.spec.ts', 'account-settings.spec.ts', 'feed-actions.spec.ts'],
  workers: 1,
  retries: 0,
  timeout: 120000,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3101',
    channel: 'msedge',
    headless: true,
    viewport: { width: 390, height: 844 },
    trace: 'off',
  },
});
