import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { db } from './db';
import { classifyFashion } from '@/lib/for-you';
export const feedSources = [
  { name: 'Who What Wear', url: 'https://www.whowhatwear.com/feeds/all', host: 'whowhatwear.com' },
  { name: 'ELLE', url: 'https://www.elle.com/rss/fashion.xml', host: 'elle.com' },
];
export function safeFeedImage(value: unknown) {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      ['cdn.mos.cms.futurecdn.net', 'hips.hearstapps.com'].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function parseFashionFeed(
  xml: string,
  source: (typeof feedSources)[number],
  now = new Date(),
) {
  if (xml.length > 1_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error('Unsupported feed');
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(xml);
  if (!parsed.rss?.channel) throw new Error('Invalid feed');
  const entries = parsed.rss.channel.item;
  return (Array.isArray(entries) ? entries : entries ? [entries] : [])
    .slice(0, 80)
    .flatMap((entry) => {
      if (
        typeof entry.title !== 'string' ||
        typeof entry.link !== 'string' ||
        typeof entry.pubDate !== 'string'
      )
        return [];
      let url: URL;
      try {
        url = new URL(entry.link);
      } catch {
        return [];
      }
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        url.hostname.replace(/^www\./, '') !== source.host ||
        !url.pathname.startsWith('/fashion/')
      )
        return [];
      if (/sponsored|advertorial|paid partnership/i.test(JSON.stringify(entry.category ?? '')))
        return [];
      if (
        [entry['cf:isSponsored'], entry['cf:isPaid']].some(
          (value) => value === true || value === 'true' || value === 1 || value === '1',
        )
      )
        return [];
      url.search = '';
      url.hash = '';
      const publishedAt = new Date(entry.pubDate);
      if (
        !Number.isFinite(+publishedAt) ||
        +publishedAt > +now ||
        +publishedAt < +now - 14 * 86400000
      )
        return [];
      const title = entry.title
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;|&#39;/g, "'")
        .replace(/<[^>]*>/g, '')
        .trim()
        .slice(0, 240);
      if (!title) return [];
      const tags = classifyFashion(title);
      if (!tags.categories.length) return [];
      const media = Array.isArray(entry['media:content'])
        ? entry['media:content'][0]
        : entry['media:content'];
      const imageUrl = safeFeedImage(media?.['@_url'] ?? entry['media:thumbnail']?.['@_url']);
      const credit = media?.['media:credit'];
      const imageCredit =
        typeof credit === 'string' ? credit.replace(/<[^>]*>/g, '').slice(0, 120) : null;
      return [
        {
          id: createHash('sha256').update(url.href).digest('hex'),
          url: url.href,
          title,
          publisher: source.name,
          imageUrl,
          imageCredit,
          publishedAt,
          ...tags,
        },
      ];
    });
}
async function readFeed(url: string) {
  const original = new URL(url);
  const signal = AbortSignal.timeout(10000);
  let current = original;
  let response: Response | undefined;
  for (let hop = 0; hop <= 3; hop++) {
    response = await fetch(current, {
      redirect: 'manual',
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || hop === 3) throw new Error('Invalid feed redirect');
    const next = new URL(location, current);
    if (
      next.protocol !== 'https:' ||
      next.username ||
      next.password ||
      next.port ||
      next.hostname.replace(/^www\./, '') !== original.hostname.replace(/^www\./, '')
    )
      throw new Error('Unsafe feed redirect');
    current = next;
  }
  if (!response) throw new Error('Feed unavailable');
  if (!response.ok || !response.body) throw new Error('Feed unavailable');
  const reader = response.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1_000_000) {
      await reader.cancel();
      throw new Error('Feed too large');
    }
    parts.push(value);
  }
  return Buffer.concat(parts).toString('utf8');
}
export async function fetchFashionSource(source: (typeof feedSources)[number], now: Date) {
  const items = parseFashionFeed(await readFeed(source.url), source, now);
  if (!items.length) throw new Error('No current fashion coverage');
  return items;
}
export async function refreshTrends(force = false) {
  const now = new Date();
  await db.trendRefresh.upsert({
    where: { id: 'fashion-feeds' },
    create: { id: 'fashion-feeds', lockUntil: new Date(0), failedSources: [] },
    update: {},
  });
  const claim = await db.trendRefresh.updateMany({
    where: {
      id: 'fashion-feeds',
      lockUntil: { lte: now },
      OR: [
        { lastAttempt: null },
        { lastAttempt: { lt: new Date(+now - (force ? 5 : 45) * 60000) } },
      ],
    },
    data: { lockUntil: new Date(+now + 10 * 60000), lastAttempt: now },
  });
  if (!claim.count) return { skipped: true };
  try {
    const results = await Promise.allSettled(
      feedSources.map((source) => fetchFashionSource(source, now)),
    );
    const failedSources = feedSources
      .filter((_, index) => results[index].status === 'rejected')
      .map((source) => source.name);
    const unique = new Map(
      results
        .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
        .map((item) => [item.id, item]),
    );
    const items = [...unique.values()].sort((a, b) => +b.publishedAt - +a.publishedAt).slice(0, 60);
    await db.$transaction(
      items.map((item) =>
        db.trendItem.upsert({ where: { id: item.id }, create: item, update: item }),
      ),
    );
    await db.trendRefresh.update({
      where: { id: 'fashion-feeds' },
      data: {
        lockUntil: new Date(0),
        failedSources,
        ...(failedSources.length < feedSources.length ? { lastSuccess: now } : {}),
      },
    });
    return { skipped: false, items: items.length, failedSources };
  } catch (error) {
    await db.trendRefresh.update({
      where: { id: 'fashion-feeds' },
      data: { lockUntil: new Date(0), failedSources: feedSources.map((source) => source.name) },
    });
    throw error;
  }
}
