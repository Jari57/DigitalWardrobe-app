import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(request.url).origin;
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const allowed = new Set([expected]);
  if (configured) allowed.add(new URL(configured).origin);
  if (!origin || !allowed.has(origin))
    throw new ApiError(403, 'This request could not be verified. Reload the page and try again.');
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    throw new ApiError(403, 'Cross-site requests are not allowed.');
}
export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new ApiError(415, 'Send JSON data.');
  // Limit streamed bodies too: Content-Length is not trusted as the sole guard.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Request data is missing.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 65536) {
      await reader.cancel();
      throw new ApiError(413, 'Request is too large.');
    }
    chunks.push(value);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError(400, 'Request data is not valid JSON.');
  }
  return schema.parse(value);
}
export function handleError(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return json({ error: error.issues[0]?.message || 'Check your input.' }, 400);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return json({ error: 'This record already exists.' }, 409);
    if (error.code === 'P2025') return json({ error: 'This record was not found.' }, 404);
    if (error.code === 'P2003' || error.code === 'P2034')
      return json({ error: 'This data changed. Refresh and try again.' }, 409);
  }
  // Never log request bodies, passwords, image bytes, session values or provider errors.
  console.error('Wardrobe API failed', error instanceof Error ? error.name : 'UnknownError');
  return json({ error: 'The service is temporarily unavailable. Please try again.' }, 503);
}
