import { test, expect } from '@playwright/test';
import {
  garmentCreateSchema,
  garmentSchema,
  garmentUpdateSchema,
} from '../../src/server/validation';
import { detectionSchema } from '../../src/lib/discovery';
import { agentRequestSchema } from '../../src/server/agents/contracts';

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
