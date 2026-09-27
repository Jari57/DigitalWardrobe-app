import { defineConfig } from '@playwright/test';

// Deliberately read-only: no accounts, uploads, AI requests, or paid actions.
const baseURL = process.env.TEST_BASE_URL;
if (!baseURL || new URL(baseURL).protocol !== 'https:')
  throw new Error('Set TEST_BASE_URL to the HTTPS release being verified.');
export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'release-smoke.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: 'list',
  use: {
    baseURL,
    channel: 'msedge',
    headless: true,
    trace: 'off',
    userAgent: 'FitStalker-Release-Check/1.0 bot',
  },
});
