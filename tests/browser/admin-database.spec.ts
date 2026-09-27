import { test, expect } from '@playwright/test';
import { adminOverview } from '../../src/server/admin-overview';
import { db } from '../../src/server/db';
import { investorEvidence } from '../../src/server/investor-evidence';

// Read-only deployment gate after migrations; do not print user or request records.
test('migrated database supports the actual owner dashboard queries', async () => {
  if (!process.env.DATABASE_URL)
    throw new Error('Dashboard database verification requires DATABASE_URL.');
  try {
    const data = await adminOverview(30);
    expect(data.users).toBeGreaterThanOrEqual(0);
    expect(data.shopping.withResults).toBeLessThanOrEqual(data.shopping.searches);
    expect(data.control.version).toBeGreaterThanOrEqual(0);
    expect(typeof data.control.aiPaused).toBe('boolean');
    expect(data.people.length).toBeLessThanOrEqual(50);
    expect(data.active.returning).toBeLessThanOrEqual(data.active.active);
    const evidence = await investorEvidence();
    expect(evidence.billing.enabled).toBe(false);
    expect(evidence.traction.searchesReturningLinks).toBeLessThanOrEqual(
      evidence.traction.completedShoppingSearches,
    );
    expect(evidence.costs.recordedAiSpendUsd).toBeGreaterThanOrEqual(0);
    expect(evidence.period.fromInclusive < evidence.period.untilExclusive).toBe(true);
  } finally {
    await db.$disconnect();
  }
});
