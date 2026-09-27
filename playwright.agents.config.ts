import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testMatch: [
    'shopping-resilience.spec.ts',
    'feed-sources.spec.ts',
    'operations.spec.ts',
    'owner-access.spec.ts',
    'finance-metrics.spec.ts',
    'admin-analytics.spec.ts',
    'agent-improvements.spec.ts',
    'agent-contracts.spec.ts',
    'shopping-quality.spec.ts',
    'product-evidence.spec.ts',
    'discovery-pillars.spec.ts',
    'shopping-photo.spec.ts',
  ],
  workers: 1,
  retries: 0,
  reporter: 'list',
});
