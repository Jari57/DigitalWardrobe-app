import { test, expect } from '@playwright/test';
import { mock } from 'node:test';
import * as auth from '../../src/server/auth';
import * as evidence from '../../src/server/investor-evidence';
import { ApiError } from '../../src/server/http';
import { GET } from '../../src/app/api/admin/evidence/route';
import {
  financeScenario,
  growthPercent,
  type FinanceAssumptions,
} from '../../src/lib/finance-metrics';
test('financial scenarios keep unknowns separate from zero and handle undefined ratios', () => {
  const blank: FinanceAssumptions = {
    price: null,
    payingAccounts: null,
    churnPercent: null,
    marginPercent: null,
    acquisitionSpend: null,
    newPayingAccounts: null,
    cashOutflow: null,
    cash: null,
  };
  expect(financeScenario(blank)).toMatchObject({
    mrr: null,
    arr: null,
    cac: null,
    ltv: null,
    burn: null,
    runwayMonths: null,
  });
  const scenario = {
    price: 10,
    payingAccounts: 100,
    churnPercent: 5,
    marginPercent: 80,
    acquisitionSpend: 200,
    newPayingAccounts: 10,
    cashOutflow: 2000,
    cash: 12000,
  };
  expect(financeScenario(scenario)).toEqual({
    mrr: 1000,
    arr: 12000,
    ltv: 160,
    cac: 20,
    paybackMonths: 2.5,
    burn: 1000,
    runwayMonths: 12,
  });
  expect(
    financeScenario({ ...scenario, churnPercent: 0, newPayingAccounts: 0, cashOutflow: 1000 }),
  ).toMatchObject({ ltv: null, cac: null, runwayMonths: null, burn: 0 });
  expect(financeScenario({ ...scenario, marginPercent: 101 })).toBeNull();
  expect(financeScenario({ ...scenario, payingAccounts: 1.2 })).toBeNull();
  expect(financeScenario({ ...scenario, cash: NaN })).toBeNull();
  expect(growthPercent(3, 0)).toBeNull();
  expect(growthPercent(0, 3)).toBe(-100);
});
test('evidence export is private, admin-only and generated only after authorization', async () => {
  let role = 'visitor',
    calls = 0;
  mock.method(auth, 'requireUser', async () => {
    if (role === 'visitor') throw new ApiError(401, 'Sign in');
    return { id: 'test', isAdmin: role === 'admin' };
  });
  mock.method(auth, 'rateLimit', async () => {});
  mock.method(evidence, 'investorEvidence', async () => {
    calls++;
    return { generatedAt: '2026-09-27T00:00:00Z', schemaVersion: 1, limitations: ['Not audited'] };
  });
  try {
    expect((await GET()).status).toBe(401);
    role = 'member';
    expect((await GET()).status).toBe(403);
    expect(calls).toBe(0);
    role = 'admin';
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain(
      'fitstalker-evidence-2026-09-27.json',
    );
    expect(await response.json()).toMatchObject({ schemaVersion: 1 });
  } finally {
    mock.restoreAll();
  }
});
