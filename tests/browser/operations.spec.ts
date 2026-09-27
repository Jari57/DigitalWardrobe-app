import { test, expect } from '@playwright/test';
import { mock } from 'node:test';
import { db } from '../../src/server/db';
import * as controls from '../../src/server/service-control';
import { checkOperations } from '../../src/server/operations';

test('operations monitors the effective cap and failures from every agent without double-counting overlapping sources', async () => {
  const original = {
    journey: db.journeyMetric.aggregate,
    requests: db.agentRequest.count,
    budget: db.agentBudget.findUnique,
  };
  const env = { ...process.env };
  process.env.AI_DAILY_CAP_MICROS = '1000000';
  delete process.env.OPS_ALERT_WEBHOOK;
  let failed = 0,
    journey = 0,
    held = 200000,
    override: number | null = 250000;
  db.journeyMetric.aggregate = (async () => ({
    _sum: { count: journey },
  })) as unknown as typeof original.journey;
  db.agentRequest.count = (async () => failed) as typeof original.requests;
  db.agentBudget.findUnique = (async () => ({
    heldMicros: held,
    spentMicros: 0,
  })) as unknown as typeof original.budget;
  mock.method(controls, 'serviceControl', async () => ({
    aiPaused: false,
    dailyCapMicros: override,
    requestsPerUser: null,
    version: 0,
  }));
  mock.method(console, 'warn', () => {});
  try {
    expect(await checkOperations()).toEqual({ alerts: 1, delivery: 'not-configured' });
    override = null;
    expect(await checkOperations()).toEqual({ alerts: 0, delivery: 'not-needed' });
    held = 0;
    failed = 5;
    expect(await checkOperations()).toEqual({ alerts: 1, delivery: 'not-configured' });
    failed = 3;
    journey = 3;
    expect(await checkOperations()).toEqual({ alerts: 0, delivery: 'not-needed' });
    failed = 0;
    journey = 5;
    expect(await checkOperations()).toEqual({ alerts: 1, delivery: 'not-configured' });
  } finally {
    db.journeyMetric.aggregate = original.journey;
    db.agentRequest.count = original.requests;
    db.agentBudget.findUnique = original.budget;
    process.env = env;
    mock.restoreAll();
  }
});
