import { test, expect } from '@playwright/test';
import { mock } from 'node:test';
import * as auth from '../../src/server/auth';
import * as photos from '../../src/server/agents/product-photo';
import * as evidence from '../../src/server/agents/product-evidence';
import { db } from '../../src/server/db';
import { ApiError } from '../../src/server/http';
import { GET } from '../../src/app/api/discovery/photo/route';

test('product photo route enforces search ownership, rejects arbitrary URLs, and returns private image responses', async () => {
  let signedIn = true;
  const queries: unknown[] = [];
  let fetches = 0;
  mock.method(auth, 'requireUser', async () => {
    if (!signedIn) throw new ApiError(401, 'Sign in');
    return { id: 'owner' };
  });
  mock.method(auth, 'rateLimit', async () => {});
  const findFirst = db.agentRequest.findFirst;
  db.agentRequest.findFirst = (async (query: { where: { id: string } }) => {
    queries.push(query);
    return query.where.id === 'mine'
      ? { result: { listings: [{ url: 'https://retailer.example/products/shirt' }] } }
      : null;
  }) as unknown as typeof findFirst;
  mock.method(evidence, 'productEvidence', async () => ({
    imageUrl: 'https://cdn.example/shirt.webp',
  }));
  mock.method(photos, 'fetchProductPhoto', async (url: string) => {
    expect(url).toBe('https://cdn.example/shirt.webp');
    fetches++;
    return { data: new Uint8Array([1, 2, 3]), mimeType: 'image/webp' };
  });
  const request = (search: string, item = 'https://retailer.example/products/shirt') =>
    new Request(
      `https://fitstalker.com/api/discovery/photo?${new URLSearchParams({ search, item })}`,
    );
  try {
    expect((await GET(request('someone-elses'))).status).toBe(404);
    expect((await GET(request('mine', 'https://127.0.0.1/secret'))).status).toBe(404);
    expect(fetches).toBe(0);
    const response = await GET(request('mine'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('vary')).toBe('Cookie');
    expect(queries).toContainEqual({
      where: { id: 'mine', userId: 'owner', agent: 'shop' },
      select: { result: true },
    });
    expect(fetches).toBe(1);
    signedIn = false;
    expect((await GET(request('mine'))).status).toBe(401);
    expect(fetches).toBe(1);
  } finally {
    db.agentRequest.findFirst = findFirst;
    mock.restoreAll();
  }
});
