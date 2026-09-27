import { test, expect } from '@playwright/test';
import { feedSources, fetchFashionSource, parseFashionFeed } from '../../src/server/trend-feed';

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
