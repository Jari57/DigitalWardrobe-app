import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { ApiError } from './http';
import config from '@/lib/firebase-public.json';

export function trustedGoogleIdentity(token: DecodedIdToken) {
  const now = Math.floor(Date.now() / 1000);
  if (
    token.firebase?.sign_in_provider !== 'google.com' ||
    token.email_verified !== true ||
    !token.email ||
    !token.uid ||
    token.aud !== config.projectId ||
    token.iss !== `https://securetoken.google.com/${config.projectId}` ||
    !Number.isFinite(token.auth_time) ||
    token.auth_time > now + 30 ||
    now - token.auth_time > 300
  )
    throw new ApiError(401, 'Please sign in with Google again to confirm your identity.');
  return { uid: token.uid, email: token.email.toLowerCase() };
}
export async function verifyGoogleIdentity(idToken: string) {
  try {
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Emulator tokens are disabled.');
    const app =
      getApps().find((app) => app.name === 'wardrobe-auth') ??
      initializeApp({ projectId: config.projectId }, 'wardrobe-auth');
    return trustedGoogleIdentity(await getAuth(app).verifyIdToken(idToken));
  } catch {
    throw new ApiError(401, 'Google sign-in could not be verified. Please try again.');
  }
}
export function isAdministrator(email: string | null | undefined, googleAuthenticated: boolean) {
  return googleAuthenticated && email === 'jari57@gmail.com';
}
