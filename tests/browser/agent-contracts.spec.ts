import { test, expect } from '@playwright/test';
import {
  agentRequestSchema,
  captureResultSchema,
  validateStylistResult,
  validateSpotterResult,
} from '../../src/server/agents/contracts';

test('agent proposals cannot introduce unknown garments, duplicates or omit locks', () => {
  const result = {
    garmentIds: ['top', 'jeans'],
    explanation: 'These owned pieces suit your stated occasion.',
    limitations: [],
  };
  expect(validateStylistResult(result, ['top', 'jeans'], ['top'])).toEqual(result);
  expect(() => validateStylistResult(result, ['top'], [])).toThrow('unavailable');
  expect(() => validateStylistResult(result, ['top', 'jeans', 'coat'], ['coat'])).toThrow('locked');
  expect(() =>
    validateStylistResult({ ...result, garmentIds: ['top', 'top'] }, ['top'], []),
  ).toThrow('Duplicate');
  expect(() => validateStylistResult({ ...result, garmentIds: [] }, [], [])).toThrow();
});

test('visual results allow missing matches but reject fabricated scores and prices', () => {
  const unmatched = {
    elements: [
      { description: 'Blue trousers', garmentId: null, explanation: 'No suitable owned piece.' },
    ],
    limitations: [],
  };
  expect(validateSpotterResult(unmatched, [])).toEqual(unmatched);
  expect(
    validateSpotterResult({ elements: [], limitations: ['No clothing visible.'] }, []),
  ).toMatchObject({ elements: [] });
  const repeated = { description: 'Shirt', garmentId: 'shirt', explanation: 'Owned substitute.' };
  expect(() =>
    validateSpotterResult({ elements: [repeated, repeated], limitations: [] }, ['shirt']),
  ).toThrow('Duplicate');
  expect(() =>
    validateSpotterResult(
      { ...unmatched, elements: [{ ...unmatched.elements[0], garmentId: 'someone-elses-item' }] },
      [],
    ),
  ).toThrow('unavailable');
  expect(() => validateSpotterResult({ ...unmatched, matchScore: 98 }, [])).toThrow();
  expect(() =>
    captureResultSchema.parse({
      name: 'Tee',
      category: 'tops',
      color: '#FFFFFF',
      uncertaintyNotes: [],
      price: 100,
    }),
  ).toThrow();
});

test('agent requests reject oversized candidate lists and client-controlled provider settings', () => {
  const input = {
    agent: 'stylist',
    candidateIds: ['top'],
    lockedIds: [],
    occasion: 'Coffee',
    aesthetic: 'Minimal',
  };
  expect(agentRequestSchema.parse(input)).toEqual(input);
  expect(() =>
    agentRequestSchema.parse({
      ...input,
      candidateIds: Array.from({ length: 41 }, (_, i) => `item-${i}`),
    }),
  ).toThrow();
  expect(() =>
    agentRequestSchema.parse({ ...input, model: 'unrestricted', maxTokens: 100000 }),
  ).toThrow();
});
