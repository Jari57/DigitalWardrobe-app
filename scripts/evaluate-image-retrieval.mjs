/**
 * Standalone permissioned pilot; never imported by the customer application.
 * LIVE_IMAGE_RETRIEVAL_EVAL=true SERPAPI_API_KEY=<secret> node
 * scripts/evaluate-image-retrieval.mjs manifest.json NEW-report.json
 *
 * Manifest: the product cases from evaluate-shopping.mjs (1..4), plus mandatory
 * root permissionedForExternalUpload:true. No no-clothing cases. Each case:
 * {id,kind:'product',file,country,category,expectedUrls:[httpsURL],source:httpsURL}.
 * Files resolve relative to the manifest. Establish expectedUrls before running.
 * Upload only fixtures you have permission to send to SerpApi/Google. The Image
 * API expires image IDs after ten minutes; this is NOT a deletion/retention claim.
 * Sources checked: https://serpapi.com/image-api,
 * https://serpapi.com/google-lens-api, https://serpapi.com/google-lens-products-api
 */
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';

const ORIGIN = 'https://serpapi.com';
const MAX_RESPONSE = 1_000_000;
const MAX_IMAGE = 500_000;
const MAX_CANDIDATES = 50;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
class PilotError extends Error {}

function safeUrl(value, secret = '') {
  if (typeof value !== 'string' || value.length > 4000 || (secret && value.includes(secret)))
    return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !url.hostname.includes('.') ||
      /^[\d.]+$/.test(url.hostname) ||
      url.hostname.includes(':') ||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname) ||
      [...url.searchParams.keys()].some((key) =>
        /^(api[_-]?key|token|access_token|secret)$/i.test(key),
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
const httpsUrl = z.string().refine((value) => !!safeUrl(value));
const manifestSchema = z
  .object({
    permissionedForExternalUpload: z.literal(true),
    cases: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
            kind: z.literal('product'),
            file: z.string().min(1),
            country: z.enum(['US', 'GB', 'CA', 'AU']),
            category: z.enum(['tops', 'bottoms', 'outerwear', 'shoes', 'accessories', 'dresses']),
            expectedUrls: z.array(httpsUrl).min(1).max(10),
            source: httpsUrl,
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();

export function canonicalUrl(value) {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()])
    if (/^(utm_.+|gclid|fbclid|msclkid|ref|affiliate|affid)$/i.test(key))
      url.searchParams.delete(key);
  url.searchParams.sort();
  url.hostname = url.hostname.replace(/^www\./, '');
  url.pathname = url.pathname.replace(/\/$/, '') || '/';
  return url.href;
}

export async function normalizeFixture(bytes) {
  if (bytes.length > 10_000_000) throw new PilotError('fixture-too-large');
  // Sharp removes EXIF/ICC/XMP by default. Do not call keepMetadata/withMetadata.
  for (const [dimension, quality] of [
    [1400, 85],
    [1100, 75],
    [800, 65],
    [600, 55],
  ]) {
    const image = await sharp(bytes, { limitInputPixels: 25_000_000 })
      .rotate()
      .resize({ width: dimension, height: dimension, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality })
      .toBuffer();
    if (image.length <= MAX_IMAGE) return image;
  }
  throw new PilotError('normalized-image-too-large');
}

async function requestJson(fetcher, path, init) {
  let response;
  try {
    response = await fetcher(ORIGIN + path, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new PilotError('provider-network-failure');
  }
  if (!response.ok || response.redirected) {
    await response.body?.cancel().catch(() => {});
    throw new PilotError('provider-http-failure');
  }
  if (
    !response.headers.get('content-type')?.includes('application/json') ||
    Number(response.headers.get('content-length')) > MAX_RESPONSE ||
    !response.body
  ) {
    await response.body?.cancel().catch(() => {});
    throw new PilotError('provider-response-invalid');
  }
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE) throw new PilotError('provider-response-too-large');
      chunks.push(value);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result) || 'error' in result)
      throw new PilotError('provider-reported-error');
    return result;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error instanceof PilotError ? error : new PilotError('provider-response-invalid');
  } finally {
    reader.releaseLock();
  }
}

export async function runPilot({
  manifestPath,
  outputPath,
  env = process.env,
  fetcher = globalThis.fetch,
}) {
  const apiKey = env.SERPAPI_API_KEY?.trim();
  if (env.LIVE_IMAGE_RETRIEVAL_EVAL !== 'true' || !apiKey)
    throw new PilotError('disabled: set LIVE_IMAGE_RETRIEVAL_EVAL=true and SERPAPI_API_KEY');
  if (!manifestPath || !outputPath) throw new PilotError('manifest-and-new-report-path-required');
  let cases;
  try {
    const manifest = manifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
    if (new Set(manifest.cases.map((entry) => entry.id)).size !== manifest.cases.length)
      throw new Error();
    // Validate every fixture before the first upload or billable provider action.
    cases = await Promise.all(
      manifest.cases.map(async (entry) => {
        const file = resolve(dirname(manifestPath), entry.file);
        const info = await stat(file);
        if (
          !info.isFile() ||
          info.size > 10_000_000 ||
          !safeUrl(entry.source, apiKey) ||
          entry.expectedUrls.some((url) => !safeUrl(url, apiKey))
        )
          throw new Error();
        const raw = await readFile(file);
        return { ...entry, fixtureSha256: sha256(raw), bytes: await normalizeFixture(raw) };
      }),
    );
  } catch {
    throw new PilotError('invalid-manifest-or-fixture: use 1-4 permissioned product cases');
  }
  const report = {
    schemaVersion: 1,
    provider: 'serpapi-google-lens-products',
    startedAt: new Date().toISOString(),
    limits: {
      cases: 4,
      uploadsPerCase: 1,
      searchesPerCase: 1,
      retries: 0,
      pagination: false,
      imageBytes: MAX_IMAGE,
      responseBytes: MAX_RESPONSE,
      candidateLimit: MAX_CANDIDATES,
    },
    limitations:
      'URL retrieval only; no exact-identity, purchase availability, photo-delivery, or population-accuracy claim. Country is a search hint. No customer integration. Provider retention is not verified.',
    results: cases.map((entry) => ({
      id: entry.id,
      country: entry.country,
      source: entry.source,
      expectedUrls: entry.expectedUrls,
      fixtureSha256: entry.fixtureSha256,
      uploadedImageSha256: sha256(entry.bytes),
      uploadedBytes: entry.bytes.length,
      status: 'not-run',
      candidates: [],
    })),
  };
  // Refuse overwriting previous evidence, source fixtures, or any existing file.
  try {
    await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  } catch {
    throw new PilotError('new-report-path-unwritable-or-already-exists');
  }
  const save = () => writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
  for (const [index, entry] of cases.entries()) {
    const result = report.results[index];
    const start = Date.now();
    result.startedAt = new Date().toISOString();
    result.uploadAttempted = false;
    result.searchAttempted = false;
    try {
      const form = new FormData();
      form.set('image', new Blob([entry.bytes], { type: 'image/jpeg' }), 'input.jpg');
      form.set('api_key', apiKey);
      result.uploadAttempted = true;
      const uploaded = await requestJson(fetcher, '/image', { method: 'POST', body: form });
      if (
        typeof uploaded.image_id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,512}$/.test(uploaded.image_id)
      )
        throw new PilotError('invalid-upload-id');
      const params = new URLSearchParams({
        engine: 'google_lens',
        type: 'products',
        image_id: uploaded.image_id,
        country: entry.country.toLowerCase(),
        hl: 'en',
        api_key: apiKey,
        output: 'json',
      });
      result.searchAttempted = true;
      const search = await requestJson(fetcher, '/search?' + params, { method: 'GET' });
      if (
        search.search_metadata?.status !== 'Success' ||
        (search.visual_matches !== undefined && !Array.isArray(search.visual_matches))
      )
        throw new PilotError('search-incomplete-or-invalid');
      result.candidates = (search.visual_matches ?? [])
        .slice(0, MAX_CANDIDATES)
        .flatMap((candidate, offset) => {
          const url = safeUrl(candidate?.link, apiKey);
          return url ? [{ responseRank: offset + 1, url }] : [];
        });
      const expected = new Set(entry.expectedUrls.map(canonicalUrl));
      const match = result.candidates.find((candidate) =>
        expected.has(canonicalUrl(candidate.url)),
      );
      result.expectedUrlRank = match?.responseRank ?? null;
      result.expectedUrlRetrieved = !!match;
      result.status = 'completed';
    } catch (error) {
      result.status = 'error';
      result.reason = error instanceof PilotError ? error.message : 'evaluation-failure';
    }
    result.elapsedMs = Date.now() - start;
    await save();
    // A broken provider/configuration should not consume the remaining cases.
    if (result.status === 'error') break;
  }
  report.finishedAt = new Date().toISOString();
  report.summary = {
    preregisteredCases: cases.length,
    completedCases: report.results.filter((result) => result.status === 'completed').length,
    expectedUrlHits: report.results.filter((result) => result.expectedUrlRetrieved).length,
    // Includes failed/unrun cases: never silently shrink the denominator.
    expectedUrlRecall:
      report.results.filter((result) => result.expectedUrlRetrieved).length / cases.length,
  };
  await save();
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [manifestPath, outputPath] = process.argv.slice(2);
    const report = await runPilot({ manifestPath, outputPath });
    console.log(JSON.stringify(report.summary));
    process.exitCode = report.results.every(
      (result) => result.status === 'completed' && result.expectedUrlRetrieved,
    )
      ? 0
      : 1;
  } catch (error) {
    console.error(
      error instanceof PilotError
        ? error.message
        : 'Pilot failed; no raw provider response was logged.',
    );
    process.exitCode = 1;
  }
}
