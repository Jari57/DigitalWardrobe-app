import { test, expect } from '@playwright/test';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadEnvConfig } from '@next/env';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { trustedGoogleIdentity, isAdministrator } from '../../src/server/google';
loadEnvConfig(process.cwd());

test('admin route requires a Google-authenticated session even for the designated email', async ({
  request,
}) => {
  const db = new PrismaClient(),
    raw = randomBytes(32).toString('base64url');
  const user = await db.user.create({
    data: {
      username: 'qa_' + randomBytes(8).toString('hex'),
      passwordHash: 'google-only',
      recoveryHash: 'google-only',
      googleUid: 'qa-' + randomBytes(8).toString('hex'),
      googleEmail: 'jari57@gmail.com',
    },
  });
  try {
    const session = await db.session.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(raw).digest('hex'),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    const headers = { Cookie: `__Host-wardrobe-session=${raw}` };
    expect((await request.get('/admin', { headers })).status()).toBe(404);
    await db.session.update({ where: { id: session.id }, data: { googleAuthenticated: true } });
    expect((await request.get('/admin', { headers })).status()).toBe(200);
    await db.user.update({
      where: { id: user.id },
      data: { googleEmail: 'not-admin@example.com' },
    });
    expect((await request.get('/admin', { headers })).status()).toBe(404);
    expect(
      (
        await request.post('/api/auth', {
          headers: { Origin: 'http://localhost:3100' },
          data: {
            action: 'recover',
            username: user.username,
            password: 'a-long-fixture-password',
            recoveryCode: 'invalid-code',
          },
        })
      ).status(),
    ).toBe(401);
  } finally {
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});

test('Google identity requires verified email, correct provider/project and fresh authentication', () => {
  const token = {
    uid: 'google-fixture',
    email: 'jari57@gmail.com',
    email_verified: true,
    aud: 'digitalwardrobe-app',
    iss: 'https://securetoken.google.com/digitalwardrobe-app',
    auth_time: Math.floor(Date.now() / 1000),
    firebase: { sign_in_provider: 'google.com' },
  } as DecodedIdToken;
  expect(trustedGoogleIdentity(token)).toEqual({
    uid: 'google-fixture',
    email: 'jari57@gmail.com',
  });
  for (const change of [
    { email_verified: false },
    { aud: 'other-project' },
    { iss: 'https://attacker.example' },
    { auth_time: token.auth_time - 301 },
    { auth_time: token.auth_time + 90 },
    { firebase: { sign_in_provider: 'password' } },
  ])
    expect(() => trustedGoogleIdentity({ ...token, ...change } as DecodedIdToken)).toThrow();
  expect(isAdministrator('jari57@gmail.com', false)).toBe(false);
  expect(isAdministrator('someone@gmail.com', true)).toBe(false);
  expect(isAdministrator('jari57@gmail.com', true)).toBe(true);
});

test('Google entry is visible; forged token and ordinary account cannot access administration', async ({
  page,
  context,
}) => {
  const headers = { Origin: 'http://localhost:3100' },
    password = randomBytes(20).toString('hex');
  await page.goto('/login');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible();
  const fake =
    Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') +
    '.' +
    Buffer.from(
      JSON.stringify({
        uid: 'attacker',
        email: 'jari57@gmail.com',
        email_verified: true,
        padding: 'x'.repeat(100),
      }),
    ).toString('base64url') +
    '.';
  expect(
    (await context.request.post('/api/auth/google', { headers, data: { idToken: fake } })).status(),
  ).toBe(401);
  expect(
    (await context.request.post('/api/auth/google', { data: { idToken: fake } })).status(),
  ).toBe(403);
  expect(
    (
      await context.request.post('/api/auth', {
        headers,
        data: { action: 'signup', username: 'qa_' + randomBytes(8).toString('hex'), password },
      })
    ).status(),
  ).toBe(201);
  try {
    expect((await context.request.get('/api/session')).headers()['cache-control']).toBe('no-store');
    expect((await (await context.request.get('/api/session')).json()).user.isAdmin).toBe(false);
    expect((await context.request.get('/admin')).status()).toBe(404);
    expect(
      (await context.request.delete('/api/account', { headers, data: { idToken: fake } })).status(),
    ).toBe(401);
  } finally {
    expect(
      (await context.request.delete('/api/account', { headers, data: { password } })).status(),
    ).toBe(200);
  }
});
