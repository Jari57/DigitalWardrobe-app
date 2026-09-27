// Offline only. node scripts/compare-retrieval-reports.mjs app.json pilot.json NEW-comparison.json
// A blocked comparison exits 1. Legacy normalized WebP hashes are never treated
// as raw fixture hashes or as equivalent to the pilot's normalized JPEG hashes.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalUrl } from './evaluate-image-retrieval.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const url = z.string().url();
const common = z
  .object({
    id: z.string().min(1).max(80),
    fixtureSha256: digest.optional(),
    country: z.enum(['US', 'GB', 'CA', 'AU']).optional(),
    expectedUrls: z.array(url).min(1).max(10).optional(),
    elapsedMs: z.number().finite().nonnegative().optional(),
  })
  .passthrough();
const appSchema = z
  .object({
    startedAt: z.string(),
    completedAt: z.string().optional(),
    base: url,
    results: z
      .array(
        common.extend({
          kind: z.enum(['product', 'no-clothing']),
          imageSha256: digest.optional(),
          status: z.enum(['pending', 'blocked', 'passed', 'failed', 'error']),
          listings: z.array(z.object({ url }).passthrough()).max(50).optional(),
        }),
      )
      .min(1)
      .max(4),
  })
  .passthrough();
const pilotSchema = z
  .object({
    schemaVersion: z.literal(1),
    provider: z.literal('serpapi-google-lens-products'),
    startedAt: z.string(),
    finishedAt: z.string().optional(),
    results: z
      .array(
        common.extend({
          uploadedImageSha256: digest.optional(),
          status: z.enum(['not-run', 'completed', 'error']),
          candidates: z
            .array(z.object({ responseRank: z.number().int().min(1).max(50), url }))
            .max(50),
        }),
      )
      .min(1)
      .max(4),
  })
  .passthrough();

function targets(row) {
  return row?.expectedUrls ? [...new Set(row.expectedUrls.map(canonicalUrl))].sort() : null;
}
function rowMetric(row, type) {
  if (!row) return { status: 'missing', rank: null };
  const completed =
    type === 'app'
      ? ['passed', 'failed'].includes(row.status) && Array.isArray(row.listings)
      : row.status === 'completed';
  const expected = targets(row);
  const candidates =
    type === 'app'
      ? (row.listings ?? []).map((entry, index) => ({ ...entry, responseRank: index + 1 }))
      : row.candidates;
  const found =
    completed && expected
      ? candidates.filter((entry) => expected.includes(canonicalUrl(entry.url)))
      : [];
  const rank = found.length ? Math.min(...found.map((entry) => entry.responseRank)) : null;
  return {
    status: row.status,
    completed,
    targetRecorded: !!expected,
    rank,
    ...(row.elapsedMs === undefined ? {} : { elapsedMs: row.elapsedMs }),
  };
}
function duration(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const n = ordered.length;
  return {
    samples: n,
    medianMs: n ? (ordered[Math.floor((n - 1) / 2)] + ordered[Math.floor(n / 2)]) / 2 : null,
    p95Ms: n ? ordered[Math.ceil(n * 0.95) - 1] : null,
  };
}
function summarize(rows) {
  const n = rows.length;
  const counts = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  const timed = rows.filter((row) => row.elapsedMs !== undefined);
  const hit = (cutoff) => rows.filter((row) => row.rank !== null && row.rank <= cutoff).length;
  return {
    caseDenominator: n,
    statusCounts: counts,
    completedSearches: rows.filter((row) => row.completed).length,
    observedHitsAt1: hit(1),
    observedHitsAt5: hit(5),
    observedUrlRecallAt1: n ? hit(1) / n : null,
    observedUrlRecallAt5: n ? hit(5) / n : null,
    missingTargetProvenance: rows.filter((row) => !row.targetRecorded).length,
    completedLatency: duration(timed.filter((row) => row.completed).map((row) => row.elapsedMs)),
    failureOrUnfinishedLatency: duration(
      timed.filter((row) => !row.completed).map((row) => row.elapsedMs),
    ),
    missingLatencySamples: n - timed.length,
  };
}

export function compareReports(appInput, pilotInput) {
  const app = appSchema.safeParse(appInput),
    pilot = pilotSchema.safeParse(pilotInput);
  if (!app.success || !pilot.success)
    throw new Error('Invalid report shape; no comparison produced.');
  const appProducts = app.data.results.filter((row) => row.kind === 'product');
  if (!appProducts.length) throw new Error('App report has no product cases.');
  for (const rows of [app.data.results, pilot.data.results])
    if (new Set(rows.map((row) => row.id)).size !== rows.length)
      throw new Error('Duplicate case IDs.');
  for (const row of pilot.data.results)
    if (
      new Set(row.candidates.map((candidate) => candidate.responseRank)).size !==
      row.candidates.length
    )
      throw new Error('Duplicate provider response ranks.');
  const ids = [...new Set([...appProducts, ...pilot.data.results].map((row) => row.id))].sort();
  const blockers = [];
  const cases = ids.map((id) => {
    const a = appProducts.find((row) => row.id === id),
      p = pilot.data.results.find((row) => row.id === id);
    if (!a || !p) blockers.push({ id, reason: 'case-missing-from-one-report' });
    else {
      if (!a.fixtureSha256 || !p.fixtureSha256)
        blockers.push({
          id,
          reason: 'raw-fixture-hash-missing; normalized-WebP-and-JPEG-hashes-are-not-comparable',
        });
      else if (a.fixtureSha256 !== p.fixtureSha256)
        blockers.push({ id, reason: 'raw-fixture-hash-mismatch' });
      if (!a.country || !p.country) blockers.push({ id, reason: 'country-not-recorded' });
      else if (a.country !== p.country) blockers.push({ id, reason: 'country-mismatch' });
      const at = targets(a),
        pt = targets(p);
      if (!at || !pt) blockers.push({ id, reason: 'predeclared-targets-not-recorded' });
      else if (JSON.stringify(at) !== JSON.stringify(pt))
        blockers.push({ id, reason: 'predeclared-targets-mismatch' });
    }
    return {
      id,
      provenance: {
        appRawFixtureSha256: a?.fixtureSha256 ?? null,
        pilotRawFixtureSha256: p?.fixtureSha256 ?? null,
        appNormalizedWebpSha256: a?.imageSha256 ?? null,
        pilotNormalizedJpegSha256: p?.uploadedImageSha256 ?? null,
        appCountry: a?.country ?? null,
        pilotCountry: p?.country ?? null,
        appExpectedUrls: a?.expectedUrls ?? null,
        pilotExpectedUrls: p?.expectedUrls ?? null,
      },
      app: rowMetric(a, 'app'),
      pilot: rowMetric(p, 'pilot'),
    };
  });
  const appMetrics = summarize(cases.map((entry) => entry.app));
  const pilotMetrics = summarize(cases.map((entry) => entry.pilot));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    comparisonStatus: blockers.length ? 'blocked' : 'provenance-compatible',
    blockers,
    provenance: {
      appParsedReportSha256: hash(JSON.stringify(appInput)),
      pilotParsedReportSha256: hash(JSON.stringify(pilotInput)),
      appStartedAt: app.data.startedAt,
      pilotStartedAt: pilot.data.startedAt,
      appCompletedAt: app.data.completedAt ?? null,
      pilotFinishedAt: pilot.data.finishedAt ?? null,
    },
    scope: {
      app: 'App output after detection, retrieval, ranking, region/budget filters and visual checks; latency includes upload/detection/search/photo probes.',
      pilot:
        'Raw Lens product candidate URLs, without app validation; latency includes provider image upload and product search.',
      metric:
        'Observed predeclared URL recall, not exact-item accuracy or precision. Failed, blocked, unfinished and omitted product cases remain in the union denominator with zero observed hits. Negative no-clothing cases are excluded and counted separately.',
      caveat:
        'Compatible fixture provenance does not make the two pipelines equivalent; transformed image bytes and validation stages differ. No causal latency or quality-superiority claim.',
    },
    excludedAppNegativeCases: app.data.results.filter((row) => row.kind === 'no-clothing').length,
    app: appMetrics,
    pilot: pilotMetrics,
    cases,
    ...(blockers.length
      ? {}
      : {
          descriptiveRecallDifference: {
            at1: pilotMetrics.observedUrlRecallAt1 - appMetrics.observedUrlRecallAt1,
            at5: pilotMetrics.observedUrlRecallAt5 - appMetrics.observedUrlRecallAt5,
          },
        }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [appPath, pilotPath, outputPath] = process.argv.slice(2);
    if (!appPath || !pilotPath || !outputPath)
      throw new Error('Provide app report, pilot report and NEW output path.');
    const inputs = await Promise.all(
      [appPath, pilotPath].map(async (path) => {
        if ((await stat(path)).size > 2_000_000) throw new Error('Report too large.');
        return readFile(path);
      }),
    );
    const comparison = compareReports(...inputs.map((bytes) => JSON.parse(bytes.toString('utf8'))));
    comparison.provenance.appFileSha256 = hash(inputs[0]);
    comparison.provenance.pilotFileSha256 = hash(inputs[1]);
    await writeFile(outputPath, JSON.stringify(comparison, null, 2) + '\n', { flag: 'wx' });
    console.log(
      JSON.stringify({
        comparisonStatus: comparison.comparisonStatus,
        blockers: comparison.blockers,
      }),
    );
    process.exitCode = comparison.comparisonStatus === 'blocked' ? 1 : 0;
  } catch {
    console.error(
      'Comparison rejected: check input formats and use a new output path. No report was overwritten.',
    );
    process.exitCode = 1;
  }
}
