import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: [
    'simple-flow.spec.ts',
    'screenshot-entry.spec.ts',
    'daily-ux.spec.ts',
    'mvp-discovery.spec.ts',
    'canvas-layout.spec.ts',
    'feed-visuals.spec.ts',
  ],
  workers: 1,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3112',
    viewport: { width: 390, height: 844 },
    channel: 'msedge',
    headless: true,
    trace: 'off',
  },
  webServer: {
    command: 'node node_modules/next/dist/bin/next start --port 3112',
    url: 'http://localhost:3112',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
