import { test, expect } from '@playwright/test';
import { adminOverview } from '../../src/server/admin-overview';
import { db } from '../../src/server/db';

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
  } finally {
    await db.$disconnect();
  }
});
