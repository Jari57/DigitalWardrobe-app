import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { runPilot, normalizeFixture, canonicalUrl } from './evaluate-image-retrieval.mjs';

const env = { LIVE_IMAGE_RETRIEVAL_EVAL: 'true', SERPAPI_API_KEY: 'FAKE_TEST_SECRET' };
const expected = 'https://retailer.example/products/shirt?variant=blue';
const json = (data) =>
  new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
async function setup(t, count = 1) {
  const directory = await mkdtemp(join(tmpdir(), 'fitstalker-pilot-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#336699' },
  })
    .jpeg()
    .withMetadata()
    .toBuffer();
  await writeFile(join(directory, 'fixture.jpg'), bytes);
  const manifest = {
    permissionedForExternalUpload: true,
    cases: Array.from({ length: count }, (_, i) => ({
      id: `case-${i}`,
      kind: 'product',
      file: 'fixture.jpg',
      country: 'US',
      category: 'tops',
      expectedUrls: [expected],
      source: 'https://retailer.example/products/source',
    })),
  };
  const manifestPath = join(directory, 'manifest.json');
  const outputPath = join(directory, 'report.json');
  await writeFile(manifestPath, JSON.stringify(manifest));
  return { manifest, manifestPath, outputPath, bytes };
}

test('disabled or malformed pilot performs no external requests', async (t) => {
  const options = await setup(t);
  let calls = 0;
  const fetcher = () => {
    calls++;
    throw new Error('Must not dispatch');
  };
  await assert.rejects(runPilot({ ...options, env: {}, fetcher }), /disabled/);
  await assert.rejects(
    runPilot({ ...options, env: { LIVE_IMAGE_RETRIEVAL_EVAL: 'true' }, fetcher }),
    /disabled/,
  );
  options.manifest.permissionedForExternalUpload = false;
  await writeFile(options.manifestPath, JSON.stringify(options.manifest));
  await assert.rejects(runPilot({ ...options, env, fetcher }), /invalid-manifest/);
  options.manifest.permissionedForExternalUpload = true;
  options.manifest.cases.push({ ...options.manifest.cases[0], id: 'second', file: 'missing.jpg' });
  await writeFile(options.manifestPath, JSON.stringify(options.manifest));
  await assert.rejects(runPilot({ ...options, env, fetcher }), /invalid-manifest/);
  assert.equal(calls, 0);
});

test('JPEG normalization strips metadata, bounds size and retains a decodable image', async (t) => {
  const { bytes } = await setup(t);
  assert.ok((await sharp(bytes).metadata()).exif);
  const normalized = await normalizeFixture(bytes);
  const metadata = await sharp(normalized).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.equal(metadata.xmp, undefined);
  assert.equal(metadata.orientation, undefined);
  assert.ok(normalized.length <= 500_000);
  await assert.rejects(normalizeFixture(Buffer.alloc(10_000_001)), /fixture-too-large/);
});

test('four cases use only upload plus Lens products calls and score predeclared URL recall without leaking ground truth', async (t) => {
  const options = await setup(t, 4);
  let calls = 0;
  const fetcher = async (rawUrl, request) => {
    calls++;
    const url = new URL(rawUrl);
    assert.equal(url.origin, 'https://serpapi.com');
    assert.equal(request.redirect, 'error');
    assert.ok(request.signal instanceof AbortSignal);
    assert.equal(rawUrl.includes('retailer.example'), false);
    if (calls % 2) {
      assert.equal(url.pathname, '/image');
      assert.equal(request.method, 'POST');
      assert.deepEqual([...request.body.keys()], ['image', 'api_key']);
      assert.equal(request.body.get('api_key'), env.SERPAPI_API_KEY);
      const image = request.body.get('image');
      assert.equal(image.name, 'input.jpg');
      assert.equal(image.type, 'image/jpeg');
      assert.ok(image.size <= 500_000);
      return json({ image_id: 'temporary_image_id' });
    }
    assert.equal(url.pathname, '/search');
    assert.equal(request.method, 'GET');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      engine: 'google_lens',
      type: 'products',
      image_id: 'temporary_image_id',
      country: 'us',
      hl: 'en',
      api_key: env.SERPAPI_API_KEY,
      output: 'json',
    });
    return json({
      search_metadata: { status: 'Success' },
      visual_matches: [
        { link: expected.replace('blue', 'red'), title: 'Wrong variant' },
        { link: expected + '&utm_source=lens', exact_matches: true },
        { link: 'https://127.0.0.1/private' },
        { link: 'javascript:alert(1)' },
        { link: 'https://retailer.example/' + env.SERPAPI_API_KEY },
        { link: 'https://retailer.example/products/secret?api_key=redacted' },
      ],
      raw_secret: env.SERPAPI_API_KEY,
    });
  };
  const report = await runPilot({ ...options, env, fetcher });
  assert.equal(calls, 8);
  assert.equal(report.summary.expectedUrlRecall, 1);
  for (const result of report.results) {
    assert.equal(result.expectedUrlRank, 2);
    assert.equal(result.candidates.length, 2);
    assert.match(result.fixtureSha256, /^[a-f0-9]{64}$/);
    assert.match(result.uploadedImageSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(result.fixtureSha256, result.uploadedImageSha256);
    assert.ok(result.elapsedMs >= 0);
    assert.ok(result.startedAt);
  }
  const saved = await readFile(options.outputPath, 'utf8');
  assert.equal(saved.includes(env.SERPAPI_API_KEY), false);
  assert.equal(saved.includes('temporary_image_id'), false);
  assert.equal(saved.includes('raw_secret'), false);
  assert.equal(saved.includes('exact_matches'), false);
  assert.notEqual(canonicalUrl(expected), canonicalUrl(expected.replace('blue', 'red')));
  assert.equal(canonicalUrl(expected), canonicalUrl(expected + '&utm_source=test'));
  await assert.rejects(runPilot({ ...options, env, fetcher }), /already-exists/);
  assert.equal(calls, 8);
});

test('provider failures and oversized bodies stop without retries or raw response logging', async (t) => {
  for (const response of [
    () => json({ error: env.SERPAPI_API_KEY }),
    () =>
      new Response('redirect', { status: 302, headers: { Location: 'https://other.example/' } }),
    () => new Response('x'.repeat(1_000_001), { headers: { 'Content-Type': 'application/json' } }),
  ]) {
    const options = await setup(t, 2);
    let calls = 0;
    const report = await runPilot({
      ...options,
      env,
      fetcher: async () => {
        calls++;
        return response();
      },
    });
    assert.equal(calls, 1);
    assert.equal(report.results[0].status, 'error');
    assert.equal(report.results[1].status, 'not-run');
    assert.equal(report.summary.preregisteredCases, 2);
    assert.equal(report.summary.expectedUrlRecall, 0);
    assert.equal(JSON.stringify(report).includes(env.SERPAPI_API_KEY), false);
  }
});

test('successful empty results count as misses and incomplete searches never poll', async (t) => {
  for (const search of [
    { search_metadata: { status: 'Success' }, visual_matches: [] },
    { search_metadata: { status: 'Processing' } },
    { search_metadata: { status: 'Success' }, visual_matches: {} },
  ]) {
    const options = await setup(t);
    let calls = 0;
    const report = await runPilot({
      ...options,
      env,
      fetcher: async () => {
        calls++;
        return json(calls === 1 ? { image_id: 'fixture_id' } : search);
      },
    });
    assert.equal(calls, 2);
    assert.equal(report.summary.expectedUrlHits, 0);
    assert.equal(
      report.results[0].status,
      Array.isArray(search.visual_matches) ? 'completed' : 'error',
    );
  }
});
