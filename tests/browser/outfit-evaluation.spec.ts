import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { loadEnvConfig } from '@next/env';
import { PrismaClient } from '@prisma/client';

// Opt-in, real provider evaluation. Source and manually reviewed expectations:
// docs/PHOTO_EVALUATION.md. At most three AI actions; no automatic retries.
test('layered group outfit detection and sparse closet matching stay grounded', async ({
  context,
}, testInfo) => {
  test.skip(
    !process.env.LIVE_OUTFIT_PHOTO,
    'Requires the documented, locally downloaded group photo.',
  );
  test.setTimeout(180_000);
  loadEnvConfig(process.cwd());
  const db = new PrismaClient();
  const password = randomBytes(20).toString('hex');
  const headers = { Origin: 'http://localhost:3100' };
  const api = context.request;
  expect(
    (
      await api.post('/api/auth', {
        headers,
        data: { action: 'signup', username: `qa_${randomBytes(7).toString('hex')}`, password },
      })
    ).status(),
  ).toBe(201);
  const report: Record<string, unknown> = { case: 'layered-group-v1', calls: [] };
  try {
    const image = await api.post('/api/uploads', {
      headers,
      multipart: {
        file: {
          name: 'group.jpg',
          mimeType: 'image/jpeg',
          buffer: await readFile(process.env.LIVE_OUTFIT_PHOTO!),
        },
      },
    });
    expect(image.status()).toBe(201);
    const { imageUrl } = await image.json();
    const imageId = imageUrl.split('/').pop();
    const owned = [
      { name: 'Blue denim jacket', category: 'outerwear', color: '#436985' },
      { name: 'White sleeveless layered blouse', category: 'tops', color: '#f3f1eb' },
      { name: 'Bright red formal evening gown', category: 'dresses', color: '#e91c24' },
      { name: 'Yellow rain boots', category: 'shoes', color: '#f5df18' },
    ];
    const candidateIds: string[] = [];
    for (const garment of owned) {
      const response = await api.post('/api/garments', {
        headers,
        data: { ...garment, brand: '', price: null, imageUrl },
      });
      expect(response.status()).toBe(201);
      candidateIds.push((await response.json()).garment.id);
    }
    async function run(path: string, data: Record<string, unknown>) {
      const start = Date.now();
      const response = await api.post(path, { headers, data });
      expect(response.status(), await response.text()).toBe(200);
      const result = await response.json();
      const accounting = await db.agentRequest.findUnique({
        where: { id: result.id },
        select: { state: true, actualMicros: true, reservedMicros: true },
      });
      (report.calls as unknown[]).push({
        agent: data.agent,
        elapsedMs: Date.now() - start,
        result,
        accounting,
      });
      return result;
    }
    const detection = await run('/api/discovery', { agent: 'detect', imageId });
    expect(detection.items.length).toBeGreaterThanOrEqual(3);
    expect(detection.items.length).toBeLessThanOrEqual(6);
    expect(detection.note).toContain('up to six pieces');
    for (const category of ['outerwear', 'tops', 'bottoms'])
      expect(
        detection.items.some((item: { category: string }) => item.category === category),
        category,
      ).toBe(true);
    expect(
      detection.items.every((item: { visibleBrand: string | null }) => !item.visibleBrand),
    ).toBe(true);
    const input = { agent: 'spotter', imageId, candidateIds };
    const matched = await run('/api/spotter', input);
    const chosen = matched.elements
      .map((item: { garmentId: string | null }) => item.garmentId)
      .filter(Boolean);
    expect(chosen).toContain(candidateIds[0]);
    expect(chosen).toContain(candidateIds[1]);
    expect(chosen).not.toContain(candidateIds[2]);
    expect(chosen).not.toContain(candidateIds[3]);
    expect(new Set(chosen).size).toBe(chosen.length);
    expect(
      matched.elements.some((item: { garmentId: string | null }) => item.garmentId === null),
    ).toBe(true);
    const cached = await api.post('/api/spotter', { headers, data: input });
    expect(cached.status()).toBe(200);
    expect((await cached.json()).id).toBe(matched.id);
    const empty = await run('/api/spotter', { ...input, candidateIds: [] });
    expect(empty.elements.length).toBeGreaterThanOrEqual(3);
    expect(
      empty.elements.every((item: { garmentId: string | null }) => item.garmentId === null),
    ).toBe(true);
  } finally {
    await db.$disconnect();
    await testInfo.attach('outfit-evaluation', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
    console.log(JSON.stringify(report));
    expect((await api.delete('/api/account', { headers, data: { password } })).status()).toBe(200);
  }
});
