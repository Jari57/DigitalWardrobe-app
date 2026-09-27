// Explicit, bounded live evaluation. Ground truth stays in this evaluator, never in app requests.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';

const [manifestPath, outputPath] = process.argv.slice(2);
if (
  process.env.LIVE_SHOPPING_EVAL !== 'true' ||
  !process.env.TEST_BASE_URL ||
  !manifestPath ||
  !outputPath
)
  throw new Error(
    'Set LIVE_SHOPPING_EVAL=true and TEST_BASE_URL; provide manifest.json and report.json paths.',
  );
const base = new URL(process.env.TEST_BASE_URL).origin;
const schema = z
  .object({
    cases: z
      .array(
        z.discriminatedUnion('kind', [
          z
            .object({
              id: z.string().min(1),
              kind: z.literal('product'),
              file: z.string(),
              country: z.enum(['US', 'GB', 'CA', 'AU']),
              category: z.enum(['tops', 'bottoms', 'outerwear', 'shoes', 'accessories', 'dresses']),
              expectedUrls: z.array(z.string().url()).min(1),
              source: z.string().url(),
            })
            .strict(),
          z
            .object({ id: z.string().min(1), kind: z.literal('no-clothing'), file: z.string() })
            .strict(),
        ]),
      )
      .min(1)
      .max(4),
  })
  .strict();
const manifest = schema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
if (new Set(manifest.cases.map((c) => c.id)).size !== manifest.cases.length)
  throw new Error('Duplicate case IDs');
// Decode all fixtures before creating an account or spending any allowance.
const cases = await Promise.all(
  manifest.cases.map(async (entry) => {
    const raw = await readFile(resolve(dirname(manifestPath), entry.file));
    return {
      ...entry,
      fixtureSha256: createHash('sha256').update(raw).digest('hex'),
      bytes: await sharp(raw, {
        limitInputPixels: 25_000_000,
      })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer(),
    };
  }),
);
const report = {
  startedAt: new Date().toISOString(),
  base,
  results: cases.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    fixtureSha256: entry.fixtureSha256,
    imageSha256: createHash('sha256').update(entry.bytes).digest('hex'),
    ...(entry.kind === 'product'
      ? {
          country: entry.country,
          expectedUrls: entry.expectedUrls,
          source: entry.source,
        }
      : {}),
    status: 'pending',
  })),
  cleanup: 'not-created',
  limitations:
    'Small evaluation set, not population accuracy. Retrieval of a known URL is separate from a verified exact label. No retry or budget override.',
};
const password = randomBytes(24).toString('hex');
let cookie,
  created = false;
const save = () => writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
async function call(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(195000),
  });
  const session = response.headers.get('set-cookie');
  if (session) cookie = session.split(';')[0];
  const data = await response.json();
  if (!response.ok)
    throw new Error(`${path}: ${response.status} ${data.error ?? 'Request failed'}`);
  return data;
}
const canonical = (value) => {
  const u = new URL(value);
  u.hash = '';
  for (const key of [...u.searchParams.keys()])
    if (/^(utm_.+|gclid|fbclid|ref)$/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  u.hostname = u.hostname.replace(/^www\./, '');
  return u.href.replace(/\/$/, '');
};
try {
  await call('/api/auth', 'POST', {
    action: 'signup',
    username: `qa_eval_${randomBytes(6).toString('hex')}`,
    password,
  });
  created = true;
  report.cleanup = 'pending';
  for (const entry of cases) {
    const result = report.results.find((result) => result.id === entry.id);
    const started = Date.now();
    try {
      const allowance = await call('/api/ai-allowance');
      if (
        !allowance.enabled ||
        allowance.sharedLimitReached ||
        allowance.remaining < (entry.kind === 'product' ? 2 : 1)
      ) {
        result.status = 'blocked';
        result.reason = 'Existing AI allowance';
        await save();
        continue;
      }
      const form = new FormData();
      form.set('file', new Blob([entry.bytes], { type: 'image/webp' }), 'input.webp');
      const upload = await call('/api/uploads', 'POST', form);
      const detection = await call('/api/discovery', 'POST', {
        agent: 'detect',
        imageId: upload.imageUrl.split('/').pop(),
      });
      result.detectedItems = detection.items.map(
        ({ name, category, visibleBrand, visibleModelCode }) => ({
          name,
          category,
          visibleBrand,
          visibleModelCode,
        }),
      );
      if (entry.kind === 'no-clothing') {
        result.status = detection.items.length === 0 ? 'passed' : 'failed';
      } else {
        const index = detection.items.findIndex((item) => item.category === entry.category);
        if (index < 0) {
          result.status = 'failed';
          result.reason = 'Target category not detected';
        } else {
          const shopping = await call('/api/discovery', 'POST', {
            agent: 'shop',
            detectionId: detection.id,
            itemIndex: index,
            country: entry.country,
          });
          result.listings = shopping.listings.map(
            ({ title, url, identityEvidence, visualReview, evidence }) => ({
              title,
              url,
              identityEvidence,
              visualStatus: visualReview?.status,
              hasPhotoMetadata: !!evidence?.imageUrl,
            }),
          );
          const expected = new Set(entry.expectedUrls.map(canonical));
          const rank = shopping.listings.findIndex((listing) =>
            expected.has(canonical(listing.url)),
          );
          result.expectedUrlRank = rank < 0 ? null : rank + 1;
          result.verifiedExactLabels = shopping.listings.filter(
            (listing) => listing.identityEvidence === 'matching-code-and-visuals',
          ).length;
          result.photoResponses = [];
          for (const listing of shopping.listings.slice(0, 5)) {
            const photo = await fetch(
              base +
                '/api/discovery/photo?' +
                new URLSearchParams({ search: shopping.id, item: listing.url }),
              { headers: { Cookie: cookie }, signal: AbortSignal.timeout(30000) },
            );
            const bytes = new Uint8Array(await photo.arrayBuffer());
            let decoded = false;
            if (photo.ok) {
              try {
                const meta = await sharp(bytes).metadata();
                decoded = !!meta.width && !!meta.height;
              } catch {}
            }
            result.photoResponses.push({ url: listing.url, status: photo.status, decoded });
          }
          result.status = rank >= 0 ? 'passed' : 'failed';
        }
      }
    } catch (error) {
      result.status = 'error';
      result.reason = error.message;
    }
    result.elapsedMs = Date.now() - started;
    await save();
    console.log(
      JSON.stringify({
        id: result.id,
        status: result.status,
        expectedUrlRank: result.expectedUrlRank,
        verifiedExactLabels: result.verifiedExactLabels,
        photoResponses: result.photoResponses,
      }),
    );
  }
} finally {
  if (created) {
    try {
      await call('/api/account', 'DELETE', { password });
      report.cleanup = 'deleted';
    } catch {
      report.cleanup = 'failed';
      process.exitCode = 1;
    }
  }
  report.completedAt = new Date().toISOString();
  await save();
}
if (report.results.some((result) => result.status !== 'passed')) process.exitCode = 1;
