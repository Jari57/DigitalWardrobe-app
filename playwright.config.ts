import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:3100',
    viewport: { width: 390, height: 844 },
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node node_modules/next/dist/bin/next start --port 3100',
    url: 'http://localhost:3100/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
