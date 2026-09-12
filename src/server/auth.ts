import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
import { ApiError } from './http';

const derive = (password: string, salt: string): Promise<Buffer> => new Promise((resolve, reject) => {
  scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
const cookieName = process.env.NODE_ENV === 'production' ? '__Host-wardrobe-session' : 'wardrobe-session';
const lifetime = 30 * 24 * 60 * 60;
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export const recoveryCode = () => randomBytes(24).toString('base64url');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expected] = encoded.split(':');
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(expected || '')) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
export async function sessionUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { select: { id: true, username: true } } } });
  return session && session.expiresAt > new Date() ? session.user : null;
}
export async function requireUser() {
  const user = await sessionUser();
  if (!user) throw new ApiError(401, 'Sign in to continue.');
  return user;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + lifetime * 1000) } });
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: lifetime });
}
export async function signOut() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.set(cookieName, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const window = Math.floor(Date.now() / (seconds * 1000));
  const bucket = hashToken(`${key}:${window}`);
  const result = await db.rateLimit.upsert({ where: { key: bucket }, create: { key: bucket, count: 1, expiresAt: new Date((window + 1) * seconds * 1000) }, update: { count: { increment: 1 } } });
  if (result.count === 1) await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
  if (result.count > limit) throw new ApiError(429, 'Too many requests. Please wait a few minutes and try again.');
}
export function requestIp(request: Request) {
  // Vercel owns this header. Do not trust arbitrary X-Forwarded-For outside its edge.
  return process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown' : 'local';
}
