import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { compareReports } from './compare-retrieval-reports.mjs';

const expected = 'https://retailer.example/products/shirt?variant=blue';
const metadata = (id) => ({
  id,
  fixtureSha256: 'a'.repeat(64),
  country: 'US',
  expectedUrls: [expected],
});
function reports() {
  return {
    app: {
      base: 'https://fitstalker.com',
      startedAt: '2026-09-27T00:00:00Z',
      results: [
        {
          ...metadata('a'),
          kind: 'product',
          status: 'passed',
          listings: [{ url: expected }],
          elapsedMs: 100,
          imageSha256: 'b'.repeat(64),
          verifiedExactLabels: 0,
        },
        { ...metadata('b'), kind: 'product', status: 'failed', listings: [], elapsedMs: 300 },
        { ...metadata('c'), kind: 'product', status: 'error', elapsedMs: 9 },
        { id: 'negative', kind: 'no-clothing', status: 'passed', elapsedMs: 2 },
      ],
    },
    pilot: {
      schemaVersion: 1,
      provider: 'serpapi-google-lens-products',
      startedAt: '2026-09-28T00:00:00Z',
      results: [
        {
          ...metadata('a'),
          status: 'completed',
          candidates: [{ url: expected, responseRank: 5 }],
          elapsedMs: 80,
          uploadedImageSha256: 'c'.repeat(64),
        },
        { ...metadata('b'), status: 'not-run', candidates: [] },
        { ...metadata('c'), status: 'error', candidates: [], elapsedMs: 12 },
      ],
    },
  };
}

test('compatible raw provenance compares observed URL recall with all failed/unrun cases and separate latency', () => {
  const { app, pilot } = reports();
  const result = compareReports(app, pilot);
  assert.equal(result.comparisonStatus, 'provenance-compatible');
  assert.equal(result.app.caseDenominator, 3);
  assert.equal(result.pilot.caseDenominator, 3);
  assert.equal(result.excludedAppNegativeCases, 1);
  assert.equal(result.app.observedUrlRecallAt1, 1 / 3);
  assert.equal(result.app.observedUrlRecallAt5, 1 / 3);
  assert.equal(result.pilot.observedUrlRecallAt1, 0);
  assert.equal(result.pilot.observedUrlRecallAt5, 1 / 3);
  assert.deepEqual(result.app.completedLatency, { samples: 2, medianMs: 200, p95Ms: 300 });
  assert.deepEqual(result.app.failureOrUnfinishedLatency, { samples: 1, medianMs: 9, p95Ms: 9 });
  assert.equal(result.pilot.missingLatencySamples, 1);
  assert.match(result.scope.app, /validation|checks/);
  assert.match(result.scope.pilot, /without app validation/);
  assert.match(result.scope.metric, /not exact-item accuracy/);
  assert.equal(result.cases[0].provenance.appNormalizedWebpSha256, 'b'.repeat(64));
  assert.equal(result.cases[0].provenance.pilotNormalizedJpegSha256, 'c'.repeat(64));
  assert.match(result.provenance.appParsedReportSha256, /^[a-f0-9]{64}$/);
});

test('raw fixture, country and target mismatches block paired comparison instead of generating deltas', () => {
  for (const [field, value, reason] of [
    ['fixtureSha256', 'd'.repeat(64), 'raw-fixture-hash-mismatch'],
    ['country', 'GB', 'country-mismatch'],
    ['expectedUrls', [expected.replace('blue', 'red')], 'predeclared-targets-mismatch'],
  ]) {
    const { app, pilot } = reports();
    pilot.results[0][field] = value;
    const result = compareReports(app, pilot);
    assert.equal(result.comparisonStatus, 'blocked');
    assert.ok(result.blockers.some((blocker) => blocker.reason === reason));
    assert.equal(result.descriptiveRecallDifference, undefined);
  }
});

test('legacy app hashes/country omissions remain unproven even if normalized hashes happen to agree', () => {
  const { app, pilot } = reports();
  delete app.results[0].fixtureSha256;
  delete app.results[0].country;
  app.results[0].imageSha256 = pilot.results[0].fixtureSha256;
  const result = compareReports(app, pilot);
  assert.equal(result.comparisonStatus, 'blocked');
  assert.ok(result.blockers.some((blocker) => blocker.reason.includes('normalized-WebP-and-JPEG')));
  assert.ok(result.blockers.some((blocker) => blocker.reason === 'country-not-recorded'));
  assert.equal(result.cases[0].provenance.appRawFixtureSha256, null);
  assert.equal(result.cases[0].provenance.appNormalizedWebpSha256, 'a'.repeat(64));
  assert.equal(result.descriptiveRecallDifference, undefined);
});

test('omitted product cases stay in both denominators and missing initial targets block comparability', () => {
  const { app, pilot } = reports();
  app.results = app.results.filter((row) => row.id !== 'b');
  delete app.results.find((row) => row.id === 'c').expectedUrls;
  const result = compareReports(app, pilot);
  assert.equal(result.app.caseDenominator, 3);
  assert.equal(result.app.statusCounts.missing, 1);
  assert.equal(result.pilot.caseDenominator, 3);
  assert.equal(result.comparisonStatus, 'blocked');
  assert.ok(result.blockers.some((blocker) => blocker.reason === 'case-missing-from-one-report'));
  assert.ok(
    result.blockers.some((blocker) => blocker.reason === 'predeclared-targets-not-recorded'),
  );
});

test('rank is recomputed from returned URLs and failed stages never earn hits from partial results', () => {
  const { app, pilot } = reports();
  app.results[0].expectedUrlRank = 1;
  app.results[0].exactProductRank = 1;
  app.results[0].listings = [{ url: expected.replace('blue', 'red') }];
  pilot.results[0].expectedUrlRank = 1;
  pilot.results[0].expectedUrlRetrieved = true;
  pilot.results[0].candidates[0].url += '&utm_source=lens';
  app.results[2].listings = [{ url: expected }];
  const result = compareReports(app, pilot);
  assert.equal(result.app.observedHitsAt1, 0);
  assert.equal(result.app.observedHitsAt5, 0);
  assert.equal(result.pilot.observedHitsAt1, 0);
  assert.equal(result.pilot.observedHitsAt5, 1);
  assert.equal(result.cases[2].app.rank, null);
});

test('duplicate identifiers/ranks and malformed reports are rejected', () => {
  const { app, pilot } = reports();
  const duplicate = structuredClone(pilot);
  duplicate.results[1].id = 'a';
  assert.throws(() => compareReports(app, duplicate), /Duplicate case/);
  pilot.results[0].candidates.push({ url: expected, responseRank: 5 });
  assert.throws(() => compareReports(app, pilot), /Duplicate provider response ranks/);
  assert.throws(() => compareReports({}, {}), /Invalid report shape/);
});

test('app evaluation records raw provenance for every preregistered case even when signup fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fitstalker-provenance-'));
  const manifestPath = join(directory, 'manifest.json'),
    outputPath = join(directory, 'report.json');
  const originalArgv = process.argv;
  const originalFetch = globalThis.fetch;
  const originalFlag = process.env.LIVE_SHOPPING_EVAL;
  const originalBase = process.env.TEST_BASE_URL;
  const bytes = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#336699' },
  })
    .png()
    .toBuffer();
  const rawHash = createHash('sha256').update(bytes).digest('hex');
  await writeFile(join(directory, 'fixture.png'), bytes);
  await writeFile(
    manifestPath,
    JSON.stringify({
      cases: ['a', 'b'].map((id) => ({
        id,
        kind: 'product',
        file: 'fixture.png',
        country: 'US',
        category: 'tops',
        expectedUrls: [expected],
        source: expected,
      })),
    }),
  );
  let requests = 0;
  try {
    process.argv = ['node', 'evaluate-shopping.mjs', manifestPath, outputPath];
    process.env.LIVE_SHOPPING_EVAL = 'true';
    process.env.TEST_BASE_URL = 'https://fixture.example';
    globalThis.fetch = async () => {
      requests++;
      throw new Error('Offline simulated signup failure');
    };
    await assert.rejects(
      import('./evaluate-shopping.mjs?offline-provenance'),
      /Offline simulated signup failure/,
    );
    const report = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(requests, 1);
    assert.equal(report.results.length, 2);
    for (const row of report.results) {
      assert.equal(row.status, 'pending');
      assert.equal(row.fixtureSha256, rawHash);
      assert.notEqual(row.imageSha256, rawHash);
      assert.equal(row.country, 'US');
      assert.deepEqual(row.expectedUrls, [expected]);
      assert.equal(row.source, expected);
    }
  } finally {
    process.argv = originalArgv;
    globalThis.fetch = originalFetch;
    if (originalFlag === undefined) delete process.env.LIVE_SHOPPING_EVAL;
    else process.env.LIVE_SHOPPING_EVAL = originalFlag;
    if (originalBase === undefined) delete process.env.TEST_BASE_URL;
    else process.env.TEST_BASE_URL = originalBase;
    await rm(directory, { recursive: true, force: true });
  }
});
