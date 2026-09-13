'use client';
import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import config from './firebase-public.json';

export async function googleIdentityToken() {
  const app =
    getApps().find((app) => app.name === 'wardrobe-auth') ?? initializeApp(config, 'wardrobe-auth');
  const auth = getAuth(app);
  await setPersistence(auth, inMemoryPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth, provider);
    return await result.user.getIdToken(true);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/popup-closed-by-user') throw new Error('Google sign-in was cancelled.');
    if (code === 'auth/popup-blocked')
      throw new Error('Allow the Google sign-in popup in your browser and try again.');
    throw new Error('Google sign-in is unavailable. Try again or use your username and password.');
  } finally {
    await signOut(auth).catch(() => {});
  }
}
