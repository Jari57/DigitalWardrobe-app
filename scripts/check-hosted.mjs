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
  const result = await exec(process.execPath, [cli, ...args], { timeout: 60_000, maxBuffer: 1024 * 1024, windowsHide: true });
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
