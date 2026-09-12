// Runs against a running app. Creates and deletes only its own two test accounts.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const password = randomBytes(24).toString('hex');
const accounts = [];
let checks = 0;
async function request(account, path, method = 'GET', body, status = 200, origin = base) {
  const headers = { Origin: origin };
  if (account?.cookie) headers.Cookie = account.cookie;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  assert.equal(
    response.status,
    status,
    `${method} ${path}: ${response.status} ${text.slice(0, 200)}`,
  );
  const cookie = response.headers.get('set-cookie');
  if (cookie && account) account.cookie = cookie.split(';')[0];
  checks++;
  return response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
}
async function signup() {
  const account = { username: `qa_${randomBytes(8).toString('hex')}`, password };
  const result = await request(
    account,
    '/api/auth',
    'POST',
    { action: 'signup', username: account.username, password },
    201,
  );
  account.recoveryCode = result.recoveryCode;
  accounts.push(account);
  assert.ok(account.recoveryCode && account.cookie);
  return account;
}
try {
  await request(null, '/api/health');
  await request(null, '/api/wardrobe', 'GET', undefined, 401);
  const a = await signup(),
    b = await signup();
  assert.deepEqual(await request(a, '/api/wardrobe'), {
    garments: [],
    outfits: [],
    references: [],
  });
  await request(a, '/api/garments', 'POST', {}, 403, 'https://example.invalid');
  const invalid = new FormData();
  invalid.set('file', new Blob(['not an image'], { type: 'image/png' }), 'bad.png');
  await request(a, '/api/uploads', 'POST', invalid, 415);
  const bytes = await sharp({
    create: { width: 40, height: 60, channels: 4, background: '#c29b7f' },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set('file', new Blob([bytes], { type: 'image/png' }), 'qa.png');
  const { imageUrl } = await request(a, '/api/uploads', 'POST', form, 201);
  await request(b, imageUrl, 'GET', undefined, 404);
  const input = {
    name: 'QA <script> literal text',
    brand: '',
    category: 'tops',
    color: '#c29b7f',
    price: 0,
    imageUrl,
  };
  await request(b, '/api/garments', 'POST', input, 400);
  const { garment } = await request(a, '/api/garments', 'POST', input, 201);
  assert.equal(garment.price, 0);
  const pieces = [{ garmentId: garment.id, x: 42, y: 93, scale: 1.2, zIndex: 3 }];
  const { outfit } = await request(a, '/api/outfits', 'POST', { name: 'QA look', pieces }, 201);
  await request(b, '/api/outfits', 'POST', { name: 'Not owned', pieces }, 400);
  const saved = await request(a, '/api/wardrobe');
  assert.deepEqual(saved.outfits[0].pieces, pieces);
  assert.equal(saved.garments[0].wearCount, 0);
  const date = new Date().toISOString().slice(0, 10);
  await request(a, `/api/outfits/${outfit.id}/wear`, 'POST', { date });
  await request(a, `/api/outfits/${outfit.id}/wear`, 'POST', { date });
  assert.equal((await request(a, '/api/wardrobe')).garments[0].wearCount, 1);
  await request(b, `/api/garments/${garment.id}`, 'DELETE', undefined, 404);
  const oldCookie = a.cookie,
    oldCode = a.recoveryCode;
  const recovered = await request(a, '/api/auth', 'POST', {
    action: 'recover',
    username: a.username,
    password,
    recoveryCode: oldCode,
  });
  assert.notEqual(recovered.recoveryCode, oldCode);
  await request({ cookie: oldCookie }, '/api/wardrobe', 'GET', undefined, 401);
  await request(
    a,
    '/api/auth',
    'POST',
    { action: 'recover', username: a.username, password, recoveryCode: oldCode },
    401,
  );
  await request(a, `/api/garments/${garment.id}`, 'DELETE');
  assert.equal((await request(a, '/api/wardrobe')).garments.length, 0);
  console.log(
    `PASS: ${checks} HTTP checks plus persistence, ownership, zero-price, geometry, wear idempotency and recovery assertions.`,
  );
} finally {
  for (const account of accounts)
    await request(account, '/api/account', 'DELETE', { password: account.password });
  console.log('Test accounts and their uploaded data deleted.');
}
