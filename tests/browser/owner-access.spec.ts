import { test, expect } from '@playwright/test';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { isAdministrator, trustedGoogleIdentity } from '../../src/server/google';

test('only the existing designated Google account can receive administrator access', () => {
  expect(isAdministrator('jari57@gmail.com', true)).toBe(true);
  expect(isAdministrator('jari57@gmail.com', false)).toBe(false);
  for (const email of [
    null,
    undefined,
    '',
    'jarr57@gmail.com',
    'someone@gmail.com',
    'jari57+admin@gmail.com',
    'jari57@gmail.com.attacker.example',
    ' jari57@gmail.com',
  ]) {
    expect(isAdministrator(email, true)).toBe(false);
  }
});

test('designated email still requires verified Google identity from the correct project', () => {
  const token = {
    uid: 'fixture',
    email: 'JARI57@gmail.com',
    email_verified: true,
    aud: 'digitalwardrobe-app',
    iss: 'https://securetoken.google.com/digitalwardrobe-app',
    auth_time: Math.floor(Date.now() / 1000),
    firebase: { sign_in_provider: 'google.com' },
  } as DecodedIdToken;
  expect(trustedGoogleIdentity(token).email).toBe('jari57@gmail.com');
  for (const change of [
    { email_verified: false },
    { aud: 'other-project' },
    { firebase: { sign_in_provider: 'password' } },
    { auth_time: token.auth_time - 301 },
  ]) {
    expect(() => trustedGoogleIdentity({ ...token, ...change } as DecodedIdToken)).toThrow();
  }
});
