import { test, expect } from '@playwright/test';
import {
  publicAddress,
  fetchProductPage,
  parseProductEvidence,
} from '../../src/server/agents/product-evidence';
import { mock } from 'node:test';
import { EventEmitter } from 'node:events';
import dns from 'node:dns/promises';
import https from 'node:https';

const url = 'https://shop.example.com/products/shirt';
const checked = '2026-09-12T18:00:00.000Z';
const product = {
  '@type': 'Product',
  name: 'Blue shirt',
  url,
  offers: {
    '@type': 'Offer',
    availability: 'https://schema.org/InStock',
    price: '49.95',
    priceCurrency: 'USD',
  },
};
const html = (value: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

test('retailer evidence records source/time and does not conflate variants, expired offers or unrelated products', () => {
  expect(parseProductEvidence(html(product), url, checked)).toMatchObject({
    availability: 'in-stock',
    price: 49.95,
    currency: 'USD',
    sourceUrl: url,
    checkedAt: checked,
  });
  expect(
    parseProductEvidence(
      html({
        ...product,
        offers: { ...product.offers, availability: 'https://schema.org/SoldOut' },
      }),
      url,
      checked,
    ).availability,
  ).toBe('out-of-stock');
  expect(
    parseProductEvidence(
      html({
        ...product,
        offers: [
          product.offers,
          { ...product.offers, availability: 'https://schema.org/OutOfStock' },
        ],
      }),
      url,
      checked,
    ),
  ).toMatchObject({ availability: 'unknown' });
  expect(
    parseProductEvidence(
      html({ ...product, offers: { ...product.offers, priceValidUntil: '2025-01-01' } }),
      url,
      checked,
    ),
  ).toMatchObject({ availability: 'unknown' });
  expect(
    parseProductEvidence(
      html({ ...product, url: 'https://shop.example.com/products/other' }),
      url,
      checked,
    ).price,
  ).toBeUndefined();
  expect(
    parseProductEvidence(
      html({ ...product, offers: { ...product.offers, url: url + '?size=large' } }),
      url,
      checked,
    ).availability,
  ).toBe('unknown');
  expect(
    parseProductEvidence(
      html({ ...product, offers: { ...product.offers, price: '1,234.00' } }),
      url,
      checked,
    ).price,
  ).toBeUndefined();
  expect(
    parseProductEvidence('<script type="application/ld+json">invalid</script>', url, checked)
      .availability,
  ).toBe('unknown');
  expect(parseProductEvidence('<h1>Access denied</h1>', url, checked).availability).toBe('unknown');
  expect(parseProductEvidence(html({ '@graph': [product] }), url, checked).price).toBe(49.95);
  expect(
    parseProductEvidence(html({ '@type': 'ItemList', itemListElement: [product] }), url, checked)
      .price,
  ).toBeUndefined();
});

test('outbound product checks reject private, reserved and literal addresses', async () => {
  for (const ip of [
    '0.0.0.0',
    '10.1.2.3',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.1.1',
    '172.31.255.255',
    '192.168.1.1',
    '100.64.0.1',
    '198.18.0.1',
    '198.51.100.10',
    '203.0.113.10',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::ffff:127.0.0.1',
  ])
    expect(publicAddress(ip), ip).toBe(false);
  expect(publicAddress('8.8.8.8')).toBe(true);
  for (const target of [
    'http://example.com',
    'https://127.0.0.1',
    'https://[::1]',
    'https://user:password@example.com',
    'https://example.com:8443',
    'https://metadata.internal',
  ])
    await expect(fetchProductPage(target)).rejects.toThrow('Blocked');
});

test('fetch pins DNS, revalidates redirects and bounds response bodies', async () => {
  let connections = 0;
  let response: { status: number; headers: Record<string, string>; body: string } = {
    status: 200,
    headers: { 'content-type': 'text/html' },
    body: html(product),
  };
  const resolved: string[] = [];
  mock.method(dns, 'lookup', async (host: string) => {
    resolved.push(host);
    return [{ address: host === 'internal.example.com' ? '10.0.0.1' : '8.8.8.8', family: 4 }];
  });
  mock.method(
    https,
    'request',
    (
      _url: URL,
      options: { lookup: Function; agent: boolean; signal: AbortSignal },
      callback: Function,
    ) => {
      connections++;
      expect(options.agent).toBe(false);
      options.lookup('shop.example.com', {}, (error: unknown, address: string, family: number) => {
        expect(error).toBeNull();
        expect(address).toBe('8.8.8.8');
        expect(family).toBe(4);
      });
      const req = new EventEmitter() as EventEmitter & { end: () => void };
      req.end = () =>
        queueMicrotask(() => {
          const res = Object.assign(new EventEmitter(), {
            statusCode: response.status,
            headers: response.headers,
            destroy: () => {},
          });
          callback(res);
          res.emit('data', Buffer.from(response.body));
          res.emit('end');
        });
      return req;
    },
  );
  try {
    expect((await fetchProductPage(url)).html).toContain('Blue shirt');
    expect(resolved).toEqual(['shop.example.com']);
    response = {
      status: 302,
      headers: { location: 'https://internal.example.com/private' },
      body: '',
    };
    await expect(fetchProductPage(url)).rejects.toThrow('Blocked address');
    expect(connections).toBe(2); // Internal redirect never reaches the transport.
    response = { status: 302, headers: { location: url }, body: '' };
    await expect(fetchProductPage(url)).rejects.toThrow('Too many redirects');
    response = {
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: 'x'.repeat(1_000_001),
    };
    await expect(fetchProductPage(url)).rejects.toThrow('too large');
    response = { status: 403, headers: { 'content-type': 'text/html' }, body: 'blocked' };
    await expect(fetchProductPage(url)).rejects.toThrow('unavailable');
  } finally {
    mock.restoreAll();
  }
});
