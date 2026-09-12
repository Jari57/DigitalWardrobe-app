// Protected-preview smoke check using the authenticated Vercel CLI.
// Set TEST_BASE_URL and VERCEL_CLI_PATH; never put a bypass token in arguments.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, readFile, readdir, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const exec = promisify(execFile);
const base = new URL(process.env.TEST_BASE_URL).origin;
const cli = process.env.VERCEL_CLI_PATH;
if (!cli) throw new Error('Set VERCEL_CLI_PATH to the installed Vercel CLI entry point.');
const temp = await mkdtemp(path.resolve('.vercel/qa-'));
const cookie = path.join(temp, 'cookies');
const payload = path.join(temp, 'payload.json');
const output = path.join(temp, 'response.json');
const username = `qa_${randomBytes(7).toString('hex')}`;
const password = randomBytes(20).toString('hex');
let created = false, checks = 0;
async function call(route, method = 'GET', body, status = 200, form = false) {
  const args = ['curl', route, '--deployment', base, '--', '--silent', '--show-error', '--request', method,
    '--header', `Origin: ${base}`, '--cookie', cookie, '--cookie-jar', cookie, '--output', output, '--write-out', '%{http_code}'];
  if (form) args.push('--form', `file=@${body};type=image/png`);
  else if (body) {
    await writeFile(payload, JSON.stringify(body));
    args.push('--header', 'Content-Type: application/json', '--data-binary', `@${payload}`);
  }
  const result = await exec(process.execPath, [cli, ...args], { timeout: 120_000, maxBuffer: 1024 * 1024, windowsHide: true });
  assert.equal(Number(result.stdout.trim().slice(-3)), status, `${method} ${route} status mismatch`);
  checks++;
  return JSON.parse(await readFile(output, 'utf8'));
}
try {
  assert.equal((await call('/api/health')).database, 'ready');
  const signed = await call('/api/auth', 'POST', {action:'signup',username,password}, 201);
  created = true;
  assert.equal(signed.user.username, username);
  assert.equal((await call('/api/session')).user.username, username);
  const image = path.join(temp, 'photo.png');
  await sharp({create:{width:32,height:48,channels:4,background:'#8f9779'}}).png().toFile(image);
  const {imageUrl} = await call('/api/uploads', 'POST', image, 201, true);
  await call('/api/garments', 'POST', {name:'Hosted QA piece',brand:'',category:'tops',color:'#8f9779',price:0,imageUrl}, 201);
  assert.equal((await call('/api/wardrobe')).garments[0].price, 0);
  await call('/api/auth', 'POST', {action:'signout'});
  await call('/api/auth', 'POST', {action:'signin',username,password});
  assert.equal((await call('/api/wardrobe')).garments.length, 1);
  if (process.env.LIVE_STYLIST === 'true') {
    const { garments } = await call('/api/wardrobe');
    const input = { agent: 'stylist', candidateIds: [garments[0].id], lockedIds: [garments[0].id], occasion: 'Everyday', aesthetic: 'Minimal' };
    const styled = await call('/api/stylist', 'POST', input);
    assert.deepEqual(styled.garmentIds, input.lockedIds);
    assert.ok(styled.explanation.length > 0);
    assert.ok(styled.limitations.length > 0, 'A one-piece closet must disclose limitations.');
    assert.equal((await call('/api/stylist', 'POST', input)).id, styled.id);
    console.log('Live hosted stylist: owned lock, partial-closet limitations and cached reuse passed.');
  }
  if (process.env.LIVE_DISCOVERY_PHOTO) {
    await sharp(process.env.LIVE_DISCOVERY_PHOTO).png().toFile(image);
    const uploaded = await call('/api/uploads', 'POST', image, 201, true);
    const detected = await call('/api/discovery', 'POST', { agent: 'detect', imageId: uploaded.imageUrl.split('/').pop() });
    assert.ok(detected.items.length > 0, 'The clothing photo must produce a detected piece.');
    const input = { agent: 'shop', detectionId: detected.id, itemIndex: 0, country: 'US' };
    const shopping = await call('/api/discovery', 'POST', input);
    assert.ok(shopping.listings.length > 0, 'Live shopping search must return sourced listings.');
    assert.equal((await call('/api/discovery', 'POST', input)).id, shopping.id, 'Repeated search must reuse the saved result.');
    const item = detected.items[0];
    await call('/api/garments', 'POST', { name: item.name, brand: item.visibleBrand ?? '', category: item.category, color: item.color, price: null, imageUrl: detected.imageUrl }, 201);
    assert.equal((await call('/api/wardrobe')).garments.length, 2);
    const history = await call('/api/discovery');
    assert.ok(history.detections.some(scan => scan.id === detected.id));
    console.log(JSON.stringify({ liveDiscovery: 'passed', garment: item.name, retailers: shopping.listings.map(listing => listing.retailer) }));
  }
  console.log(`PASS: ${checks} hosted checks: account, private session, image upload, garment persistence and sign-in.`);
} finally {
  try {
    if (created) {
      // Refresh authentication so cleanup also works after a failed sign-out/sign-in check.
      await call('/api/auth', 'POST', {action:'signin',username,password});
      await call('/api/account', 'DELETE', {password});
      console.log('Hosted QA account and uploaded data deleted.');
    }
  } finally {
    // Only remove files from this uniquely created QA directory; no recursive deletion.
    for (const file of await readdir(temp)) await unlink(path.join(temp, file));
    await rmdir(temp);
  }
}
