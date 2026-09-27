import { test, expect } from '@playwright/test';
import { mock } from 'node:test';
import * as auth from '../../src/server/auth';
import { db } from '../../src/server/db';
import { ApiError } from '../../src/server/http';
import { PUT } from '../../src/app/api/admin/controls/route';
import { POST } from '../../src/app/api/traffic/route';
import { controlledAgentBudget } from '../../src/server/service-control';
import { referralChannel } from '../../src/lib/traffic';

const request = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://fitstalker.com${path}`, {
    method: 'POST',
    headers: { Origin: 'https://fitstalker.com', 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
test('admin controls reject visitors, ordinary accounts, cross-origin, overspend and stale versions; writes are audited atomically', async () => {
  const env = { ...process.env };
  process.env.AI_ENABLED = 'true';
  process.env.AI_DAILY_CAP_MICROS = '1000000';
  process.env.AI_MAX_REQUEST_MICROS = '100000';
  let role = 'visitor',
    transactions = 0;
  const writes: unknown[] = [];
  const original = db.$transaction;
  mock.method(auth, 'requireUser', async () => {
    if (role === 'visitor') throw new ApiError(401, 'Sign in');
    return { id: 'admin', isAdmin: role === 'admin' };
  });
  mock.method(auth, 'rateLimit', async () => {});
  db.$transaction = (async (work: (tx: unknown) => unknown) => {
    transactions++;
    return work({
      $queryRaw: async () => [
        { aiPaused: false, dailyCapMicros: null, requestsPerUser: null, version: 2 },
      ],
      $executeRaw: async (...args: unknown[]) => {
        writes.push(args);
        return 1;
      },
    });
  }) as typeof db.$transaction;
  const body = { aiPaused: true, dailyCapMicros: 500000, requestsPerUser: 2, version: 2 };
  try {
    expect((await PUT(request('/api/admin/controls', body))).status).toBe(401);
    role = 'user';
    expect((await PUT(request('/api/admin/controls', body))).status).toBe(403);
    role = 'admin';
    expect(
      (await PUT(request('/api/admin/controls', body, { Origin: 'https://evil.example' }))).status,
    ).toBe(403);
    expect(
      (await PUT(request('/api/admin/controls', { ...body, dailyCapMicros: 2000000 }))).status,
    ).toBe(400);
    expect(
      (await PUT(request('/api/admin/controls', { ...body, requestsPerUser: 100 }))).status,
    ).toBe(400);
    expect(transactions).toBe(0);
    expect((await PUT(request('/api/admin/controls', { ...body, version: 1 }))).status).toBe(409);
    expect(writes).toHaveLength(0);
    expect((await PUT(request('/api/admin/controls', body))).status).toBe(200);
    expect(writes).toHaveLength(2);
    expect(JSON.stringify(writes)).toContain('AdminAudit');
    expect(JSON.stringify(writes)).toContain('before');
  } finally {
    db.$transaction = original;
    mock.restoreAll();
    process.env = env;
  }
});

test('traffic collects bounded aggregates only and honors privacy signals', async () => {
  const writes: unknown[] = [];
  const original = db.$executeRaw;
  db.$executeRaw = (async (...args: unknown[]) => {
    writes.push(args);
    return 1;
  }) as typeof original;
  mock.method(auth, 'sessionUser', async () => null);
  mock.method(auth, 'rateLimit', async () => {});
  const body = { page: '/', channel: 'social', device: 'mobile' };
  try {
    expect((await POST(request('/api/traffic', body, { DNT: '1' }))).status).toBe(200);
    expect((await POST(request('/api/traffic', body, { 'Sec-GPC': '1' }))).status).toBe(200);
    expect((await POST(request('/api/traffic', body, { 'User-Agent': 'ExampleBot' }))).status).toBe(
      200,
    );
    expect(writes).toHaveLength(0);
    expect(
      (await POST(request('/api/traffic', { ...body, email: 'secret@example.com' }))).status,
    ).toBe(400);
    expect((await POST(request('/api/traffic', { ...body, page: '/admin' }))).status).toBe(400);
    expect(
      (await POST(request('/api/traffic', body, { Origin: 'https://evil.example' }))).status,
    ).toBe(403);
    const response = await POST(request('/api/traffic', body));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(writes).toHaveLength(2);
    expect(JSON.stringify(writes)).toContain('ON CONFLICT');
    expect(JSON.stringify(writes)).not.toContain('secret@example.com');
    expect(referralChannel('https://www.instagram.com/post/private?token=secret')).toBe('social');
    expect(referralChannel('https://instagram.com.evil.example/path')).toBe('referral');
  } finally {
    db.$executeRaw = original;
    mock.restoreAll();
  }
});

test('AI controls fail closed when paused or absent and cannot increase deployment ceilings', async () => {
  const env = { ...process.env };
  process.env.AI_ENABLED = 'true';
  process.env.AI_DAILY_CAP_MICROS = '1000000';
  process.env.AI_MAX_REQUEST_MICROS = '100000';
  const original = db.$queryRaw;
  let rows: unknown[] = [
    { aiPaused: true, dailyCapMicros: null, requestsPerUser: null, version: 0 },
  ];
  db.$queryRaw = (async () => rows) as typeof original;
  try {
    await expect(controlledAgentBudget()).rejects.toThrow('paused');
    rows = [];
    await expect(controlledAgentBudget()).rejects.toThrow('unavailable');
    rows = [{ aiPaused: false, dailyCapMicros: 500000, requestsPerUser: 2 }];
    expect(await controlledAgentBudget()).toMatchObject({
      dailyCapMicros: 500000,
      requestsPerUser: 2,
    });
    rows = [{ aiPaused: false, dailyCapMicros: 2000000, requestsPerUser: 100 }];
    expect(await controlledAgentBudget()).toMatchObject({
      dailyCapMicros: 1000000,
      requestsPerUser: 10,
    });
  } finally {
    db.$queryRaw = original;
    process.env = env;
  }
});
