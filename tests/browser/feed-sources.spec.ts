import { test, expect } from '@playwright/test';
import { mock } from 'node:test';
import { feedSources, fetchFashionSource, parseFashionFeed } from '../../src/server/trend-feed';

test('source failures emit bounded diagnostics without remote content or raw errors', async () => {
  const source = feedSources.find((value) => value.name === 'Hypebeast')!;
  const warnings: string[] = [];
  mock.method(console, 'warn', (value: string) => {
    warnings.push(value);
  });
  const original = global.fetch;
  const scenarios: { reason: string; status?: number; fetch: () => Promise<Response> }[] = [
    {
      reason: 'http',
      status: 403,
      fetch: async () => new Response('secret publisher body', { status: 403 }),
    },
    {
      reason: 'timeout',
      fetch: async () => {
        throw new DOMException('https://private.example/secret', 'TimeoutError');
      },
    },
    {
      reason: 'network',
      fetch: async () => {
        throw new Error('private network error stack');
      },
    },
    { reason: 'body_limit', status: 200, fetch: async () => new Response('x'.repeat(1_000_001)) },
    {
      reason: 'unsafe_redirect',
      status: 302,
      fetch: async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://private.example/secret' },
        }),
    },
    {
      reason: 'invalid_redirect',
      status: 302,
      fetch: async () => new Response(null, { status: 302 }),
    },
    {
      reason: 'invalid_xml',
      fetch: async () => new Response('<rss><channel><item></channel></rss>'),
    },
    {
      reason: 'invalid_xml',
      fetch: async () => new Response('<!DOCTYPE rss><rss><channel/></rss>'),
    },
    {
      reason: 'no_relevant_coverage',
      fetch: async () => new Response('<rss><channel><title>Fashion</title></channel></rss>'),
    },
  ];
  try {
    for (const scenario of scenarios) {
      let calls = 0;
      global.fetch = async () => {
        calls++;
        return scenario.fetch();
      };
      warnings.length = 0;
      await expect(fetchFashionSource(source, new Date())).rejects.toThrow();
      expect(calls).toBe(1);
      expect(warnings).toHaveLength(1);
      const diagnostic = JSON.parse(warnings[0]);
      expect(diagnostic).toEqual({
        event: 'fashion_feed_failed',
        source: 'Hypebeast',
        reason: scenario.reason,
        ...(scenario.status ? { httpStatus: scenario.status } : {}),
        elapsedMs: expect.any(Number),
      });
      expect(diagnostic.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(warnings[0]).not.toMatch(/secret|private|https:|stack|publisher body/);
    }
  } finally {
    global.fetch = original;
    mock.restoreAll();
  }
});

const now = new Date('2026-09-26T23:59:00Z');
const feed = (host: string, padding = '') =>
  `<rss><channel><description>${padding}</description><item><title>Classic loafers</title><link>https://${host}/fashion/test</link><pubDate>${now.toUTCString()}</pubDate><media:thumbnail url="https://cdn.mos.cms.futurecdn.net/test.jpg"/></item></channel></rss>`;

test('full-content publisher feed fits its bounded allowance without relaxing other sources', async () => {
  const www = feedSources.find((source) => source.name === 'Who What Wear')!;
  const elle = feedSources.find((source) => source.name === 'ELLE')!;
  const xml = feed(www.host, 'x'.repeat(2_900_000));
  expect(parseFashionFeed(xml, www, now)).toHaveLength(1);
  expect(() => parseFashionFeed(xml, elle, now)).toThrow('Unsupported feed');
  expect(() => parseFashionFeed(feed(www.host, 'x'.repeat(4_000_000)), www, now)).toThrow(
    'Unsupported feed',
  );
  expect(() => parseFashionFeed(feed(www.host, 'é'.repeat(2_100_000)), www, now)).toThrow(
    'Unsupported feed',
  );
  expect(() => parseFashionFeed('<!DOCTYPE rss>' + xml, www, now)).toThrow('Unsupported feed');

  const original = global.fetch;
  try {
    global.fetch = async () => new Response(xml);
    expect(await fetchFashionSource(www, now)).toHaveLength(1);
    global.fetch = async () => new Response(feed(www.host, 'x'.repeat(4_000_000)));
    await expect(fetchFashionSource(www, now)).rejects.toThrow('Feed too large');
  } finally {
    global.fetch = original;
  }
});

test('verified general RSS endpoints still exclude non-fashion and off-host stories', () => {
  for (const name of ['GQ', 'Vogue']) {
    const source = feedSources.find((source) => source.name === name)!;
    expect(new URL(source.url).pathname).toBe('/feed/rss');
    const path = name === 'GQ' ? '/story/test' : '/article/test';
    const item = (title: string, host = source.host) =>
      `<item><title>${title}</title><link>https://${host}${path}</link><pubDate>${now.toUTCString()}</pubDate><media:thumbnail url="https://${name === 'GQ' ? 'media.gq.com' : 'assets.vogue.com'}/photo.jpg"/></item>`;
    const xml = `<rss><channel>${item('Classic loafers')}${item('Daily vitamins')}${item('Classic boots', 'evil.example')}</channel></rss>`;
    const items = parseFashionFeed(xml, source, now);
    expect(items).toHaveLength(1);
    expect(items[0].imageUrl).toBeTruthy();
  }
});
