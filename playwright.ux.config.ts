import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'daily-ux.spec.ts',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3101',
    viewport: { width: 390, height: 844 },
    channel: 'msedge',
    headless: true,
  },
  webServer: {
    reuseExistingServer: true,
    command: 'node node_modules/next/dist/bin/next start --port 3101',
    url: 'http://localhost:3101',
    timeout: 60000,
  },
});
