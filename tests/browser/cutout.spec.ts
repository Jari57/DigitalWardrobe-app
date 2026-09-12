import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { loadEnvConfig } from '@next/env';
import { PrismaClient } from '@prisma/client';
import { renderGarmentCutout, segmentGarment } from '../support/cutout-candidate';
import { AgentLedger, configuredAgentBudget } from '../../src/server/agents/ledger';

test('cutout alpha preserves original pixels and holes, rejects invalid geometry', async () => {
  const original = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 23, g: 95, b: 160, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  const mask = {
    found: true,
    rings: [
      [
        [100, 100],
        [900, 100],
        [900, 900],
        [100, 900],
      ],
      [
        [400, 400],
        [600, 400],
        [600, 600],
        [400, 600],
      ],
    ],
    note: '',
  };
  const cutout = await renderGarmentCutout(original, mask);
  const raw = await sharp(cutout.data).raw().toBuffer();
  const pixel = (x: number, y: number) => [
    ...raw.subarray((y * 100 + x) * 4, (y * 100 + x) * 4 + 4),
  ];
  expect(pixel(20, 20)).toEqual([23, 95, 160, 128]);
  expect(pixel(0, 0)[3]).toBe(0);
  expect(pixel(50, 50)[3]).toBe(0);
  await expect(renderGarmentCutout(original, { ...mask, found: false, rings: [] })).rejects.toThrow(
    'No unambiguous',
  );
  await expect(
    renderGarmentCutout(original, {
      ...mask,
      rings: [
        [
          [0, 0],
          [1001, 0],
          [0, 1000],
        ],
      ],
    }),
  ).rejects.toThrow();
  await expect(
    renderGarmentCutout(original, {
      ...mask,
      rings: [
        [
          [10, 10],
          [10, 10],
          [10, 10],
        ],
      ],
    }),
  ).rejects.toThrow('coverage');
});

test('live garment segmentation candidate records bounded spend and a reviewable PNG', async ({}, testInfo) => {
  test.skip(
    !process.env.LIVE_CUTOUT_PHOTO || !process.env.LIVE_CUTOUT_DESCRIPTION,
    'Opt-in visual quality evaluation only.',
  );
  loadEnvConfig(process.cwd());
  const db = new PrismaClient();
  const user = await db.user.create({
    data: {
      username: `qa_cutout_${randomBytes(8).toString('hex')}`,
      passwordHash: 'disabled-evaluation',
      recoveryHash: 'disabled-evaluation',
    },
  });
  const ledger = new AgentLedger(db, configuredAgentBudget());
  let requestId: string | undefined;
  try {
    const input = { agent: 'capture', imageId: 'local-cutout-evaluation' };
    const reservation = await ledger.reserve(user.id, randomBytes(24).toString('hex'), input);
    requestId = reservation.request.id;
    expect(await ledger.claim(user.id, requestId)).toBe(true);
    const start = Date.now();
    const photo = await readFile(process.env.LIVE_CUTOUT_PHOTO!);
    const result = await segmentGarment(photo, 'image/jpeg', process.env.LIVE_CUTOUT_DESCRIPTION!);
    if (result.cost === null) await ledger.markUncertain(user.id, requestId);
    else
      await ledger.settle(user.id, requestId, {
        state: 'succeeded',
        actualMicros: result.cost,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        result: result.value,
      });
    const cutout = await renderGarmentCutout(photo, result.value);
    await writeFile('../cutout-evaluation.png', cutout.data);
    const report = {
      model: 'google/gemini-3.8-flash',
      elapsedMs: Date.now() - start,
      costMicros: result.cost,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      coverage: cutout.coverage,
      mask: result.value,
    };
    await testInfo.attach('cutout-candidate', { body: cutout.data, contentType: 'image/png' });
    console.log(JSON.stringify(report));
    await writeFile('../cutout-evaluation.json', JSON.stringify(report, null, 2));
    expect(cutout.coverage).toBeGreaterThan(0.002);
  } catch (error) {
    if (requestId) await ledger.markUncertain(user.id, requestId);
    throw error;
  } finally {
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
