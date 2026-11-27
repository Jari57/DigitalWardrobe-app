import { test, expect } from '@playwright/test';
import { mock } from 'node:test';
import { POST as tryOn } from '../../src/app/api/try-on/route';
import * as auth from '../../src/server/auth';
import * as serviceControl from '../../src/server/service-control';
import { db } from '../../src/server/db';
import { AgentLedger } from '../../src/server/agents/ledger';
import {
  garmentCreateSchema,
  garmentSchema,
  garmentUpdateSchema,
} from '../../src/server/validation';
import { detectionSchema } from '../../src/lib/discovery';
import { agentRequestSchema } from '../../src/server/agents/contracts';

test('try-on requires consent and one to four unique private garment references', () => {
  const request = {
    agent: 'try-on',
    photoUrl: '/api/images/photo',
    garmentIds: ['top', 'bottoms'],
    consent: true,
  };
  expect(agentRequestSchema.safeParse(request).success).toBe(true);
  for (const override of [
    { consent: false },
    { consent: undefined },
    { photoUrl: 'https://example.com/photo.png' },
    { garmentIds: [] },
    { garmentIds: ['a', 'b', 'c', 'd', 'e'] },
    { garmentIds: ['top', 'top'] },
    { userId: 'another-account' },
  ]) {
    expect(agentRequestSchema.safeParse({ ...request, ...override }).success).toBe(false);
  }
});

test('try-on checks photo and garment ownership before reserving generation', async () => {
  const browserFlag = process.env.NEXT_PUBLIC_FITSTALKER_TRY_ON_ENABLED;
  const aiFlag = process.env.AI_ENABLED;
  const photoLookup = db.image.findFirst;
  const pieceLookup = db.garment.findMany;
  const queryPhoto = mock.fn(async (_query: unknown) => null);
  const queryPieces = mock.fn(async (_query: unknown) => []);
  const reserve = mock.method(AgentLedger.prototype, 'reserve', async () => {
    throw new Error('Unowned input must never reach the generation ledger.');
  });
  mock.method(auth, 'requireUser', async () => ({ id: 'owner' }));
  mock.method(auth, 'rateLimit', async () => {});
  mock.method(serviceControl, 'controlledAgentBudget', async () => ({}));
  db.image.findFirst = queryPhoto as unknown as typeof photoLookup;
  db.garment.findMany = queryPieces as unknown as typeof pieceLookup;
  process.env.NEXT_PUBLIC_FITSTALKER_TRY_ON_ENABLED = 'true';
  process.env.AI_ENABLED = 'true';
  try {
    const response = await tryOn(
      new Request('https://fitstalker.com/api/try-on', {
        method: 'POST',
        headers: { origin: 'https://fitstalker.com', 'content-type': 'application/json' },
        body: JSON.stringify({
          agent: 'try-on',
          consent: true,
          photoUrl: '/api/images/another-users-photo',
          garmentIds: ['another-users-piece'],
        }),
      }),
    );
    expect(response.status).toBe(404);
    expect(queryPhoto.mock.calls[0].arguments).toEqual([
      { where: { id: 'another-users-photo', userId: 'owner' } },
    ]);
    expect(queryPieces.mock.calls[0].arguments[0]).toMatchObject({
      where: { userId: 'owner', id: { in: ['another-users-piece'] }, image: { userId: 'owner' } },
    });
    expect(reserve.mock.callCount()).toBe(0);
  } finally {
    db.image.findFirst = photoLookup;
    db.garment.findMany = pieceLookup;
    mock.restoreAll();
    if (browserFlag === undefined) delete process.env.NEXT_PUBLIC_FITSTALKER_TRY_ON_ENABLED;
    else process.env.NEXT_PUBLIC_FITSTALKER_TRY_ON_ENABLED = browserFlag;
    if (aiFlag === undefined) delete process.env.AI_ENABLED;
    else process.env.AI_ENABLED = aiFlag;
  }
});

test('new pieces keep defaults while partial edits do not erase saved fields', () => {
  const item = {
    name: 'Blue shirt',
    category: 'tops',
    color: '#446688',
    imageUrl: '/api/images/fixture',
  };
  expect(garmentSchema.parse(item)).toEqual({ ...item, brand: '', price: null });
  const fields = { name: item.name, category: item.category, color: item.color };
  const scan = { id: 'fixture-scan', itemIndex: 2 };
  expect(garmentCreateSchema.parse({ ...fields, scan })).toEqual({
    ...fields,
    scan,
    brand: '',
    price: null,
  });
  expect(garmentCreateSchema.safeParse({ ...item, scan }).success).toBe(false);
  expect(
    garmentCreateSchema.safeParse({ ...fields, scan: { ...scan, itemIndex: 9 } }).success,
  ).toBe(false);
  expect(garmentUpdateSchema.parse({ name: 'Updated shirt' })).toEqual({ name: 'Updated shirt' });
  expect(garmentUpdateSchema.parse({})).toEqual({});
  expect(garmentUpdateSchema.parse({ price: 0 })).toEqual({ price: 0 });
  expect(garmentUpdateSchema.parse({ brand: '', price: null })).toEqual({ brand: '', price: null });
});

test('patched validation still rejects ownership fields, invalid colors and unbounded candidate lists', () => {
  expect(garmentUpdateSchema.safeParse({ userId: 'another-account' }).success).toBe(false);
  expect(garmentUpdateSchema.safeParse({ color: 'blue' }).success).toBe(false);
  expect(garmentUpdateSchema.safeParse({ price: Number.NaN }).success).toBe(false);
  expect(
    agentRequestSchema.safeParse({
      agent: 'stylist',
      candidateIds: Array(500).fill('fixture'),
      lockedIds: [],
      occasion: 'Everyday',
      aesthetic: 'Minimal',
    }).success,
  ).toBe(false);
  expect(detectionSchema.safeParse({ items: Array(500).fill({}), note: '' }).success).toBe(false);
});
