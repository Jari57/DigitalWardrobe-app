// Publisher-owned feed endpoints. Runtime refresh verifies current coverage;
// a configured source is not a promise of availability or syndication rights.
export const feedSources = [
  {
    name: 'Who What Wear',
    url: 'https://www.whowhatwear.com/feeds/all',
    host: 'whowhatwear.com',
    paths: /^\/fashion\//,
  },
  {
    name: 'ELLE',
    url: 'https://www.elle.com/rss/fashion.xml',
    host: 'elle.com',
    paths: /^\/fashion\//,
  },
  {
    name: "Harper's Bazaar",
    url: 'https://www.harpersbazaar.com/rss/fashion.xml',
    host: 'harpersbazaar.com',
    paths: /^\/fashion\//,
  },
  {
    name: 'Esquire',
    url: 'https://www.esquire.com/rss/style.xml',
    host: 'esquire.com',
    paths: /^\/style\//,
  },
  {
    name: 'Fashionista',
    url: 'https://fashionista.com/.rss/full/',
    host: 'fashionista.com',
    paths: /^\/\d{4}\/\d{2}\//,
  },
  {
    name: 'The Guardian',
    url: 'https://www.theguardian.com/fashion/rss',
    host: 'theguardian.com',
    paths: /^\/fashion\//,
  },
  {
    name: 'Hypebeast',
    url: 'https://hypebeast.com/fashion/feed',
    host: 'hypebeast.com',
    paths: /^\/\d{4}\/\d{1,2}\//,
  },
  {
    name: 'Highsnobiety',
    url: 'https://www.highsnobiety.com/feeds/rss',
    host: 'highsnobiety.com',
    paths: /^\/p\//,
  },
  { name: 'GQ', url: 'https://www.gq.com/feed/style', host: 'gq.com', paths: /^\/story\// },
  {
    name: 'Vogue',
    url: 'https://www.vogue.com/feed/fashion',
    host: 'vogue.com',
    paths: /^\/article\//,
  },
];

// Explicit hosts only; redirects and server-side photo fetches revalidate these.
export const feedImageHosts = [
  'cdn.mos.cms.futurecdn.net',
  'hips.hearstapps.com',
  'fashionista.com',
  'assets.vogue.com',
  'media.gq.com',
  'www.highsnobiety.com',
  'image-cdn.hypb.st',
  'i.guim.co.uk',
];

export function balancePublishers<T extends { publisher: string }>(items: T[], limit: number) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.publisher) ?? [];
    group.push(item);
    groups.set(item.publisher, group);
  }
  const output: T[] = [];
  for (let round = 0; output.length < Math.min(limit, items.length); round++) {
    for (const group of groups.values()) {
      if (group[round] && output.length < limit) output.push(group[round]);
    }
  }
  return output;
}
