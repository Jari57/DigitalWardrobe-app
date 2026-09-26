// Opt-in smoke test: one detection and one shopping request; no retries or budget overrides.
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const base = process.env.TEST_BASE_URL;
if (process.env.LIVE_SHOPPING_CHECK !== 'true' || !base)
  throw new Error('Explicit live test opt-in and TEST_BASE_URL required.');
const password = randomBytes(24).toString('hex');
let cookie;
let created = false;
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
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await response.json();
  if (!response.ok)
    throw new Error(`${method} ${path}: ${response.status} ${data.error || 'Request failed'}`);
  return data;
}
try {
  await call('/api/auth', 'POST', {
    action: 'signup',
    username: `qa_scan_${randomBytes(6).toString('hex')}`,
    password,
  });
  created = true;
  const allowance = await call('/api/ai-allowance');
  console.log(JSON.stringify({ stage: 'allowance', ...allowance }));
  if (!allowance.enabled || allowance.sharedLimitReached || allowance.remaining < 2) {
    console.log(
      'BLOCKED: existing AI allowance does not permit this two-action check. No provider calls made.',
    );
  } else {
    const image = await readFile('public/brand/street-style-editorial.webp');
    const form = new FormData();
    form.set('file', new Blob([image], { type: 'image/webp' }), 'editorial-test.webp');
    const upload = await call('/api/uploads', 'POST', form);
    const detection = await call('/api/discovery', 'POST', {
      agent: 'detect',
      imageId: upload.imageUrl.split('/').pop(),
    });
    console.log(
      JSON.stringify({ stage: 'detection', items: detection.items, note: detection.note }),
    );
    const index = detection.items.findIndex((item) => item.category === 'outerwear');
    if (index < 0)
      throw new Error('The visible blazer was not detected; shopping check was not dispatched.');
    const result = await call('/api/discovery', 'POST', {
      agent: 'shop',
      detectionId: detection.id,
      itemIndex: index,
      country: 'US',
    });
    console.log(
      JSON.stringify({
        stage: 'shopping',
        count: result.listings.length,
        listings: result.listings.map(({ title, url, match, visualReview }) => ({
          title,
          url,
          match,
          visualReview,
        })),
        note: result.note,
      }),
    );
    console.log(
      result.listings.length
        ? 'PASS: image identification and shopping returned results. This is not a viral-status or exact-identity evaluation.'
        : 'FAIL: identification worked, but shopping returned no alternatives.',
    );
  }
} finally {
  if (created) {
    await call('/api/account', 'DELETE', { password });
    console.log('Temporary test account and uploaded fixture removed.');
  }
}
