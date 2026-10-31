import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from './vercel-build.mjs';

for (const environment of ['preview', 'development', undefined]) {
  test(`${environment}: builds without database operations`, () => {
    assert.deepEqual(buildPlan(environment), [
      ['npm', ['run', 'test:agent-quality']],
      ['npm', ['run', 'build']],
    ]);
  });
}
test('production retains all existing release checks in order', () => {
  assert.deepEqual(buildPlan('production'), [
    ['npm', ['run', 'test:agent-quality']],
    ['npm', ['run', 'db:migrate']],
    ['npx', ['playwright', 'test', '--config', 'playwright.admin-db.config.ts']],
    ['npm', ['run', 'build']],
  ]);
});
