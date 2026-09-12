import { test, expect } from '@playwright/test';
import {
  shoppingPageKind,
  prioritizeShoppingListings,
  groundedListings,
  type ShoppingResult,
} from '../../src/lib/discovery';
import { parseProductEvidence } from '../../src/server/agents/product-evidence';

test('shopping URL checks remove browsing and social pages without losing nested product links', () => {
  for (const url of [
    'https://shop.example/',
    'https://shop.example/en-us/',
    'https://shop.example/collections/shirts',
    'https://shop.example/category/shirts',
    'https://shop.example/search?q=shirt',
    'https://shop.example/blogs/style/blue-shirts',
    'https://www.tiktok.com/@creator/video/123',
    'https://m.pinterest.com/pin/123',
    'https://editorialist.com/shop/mens-blue-chambray-shirts/',
    'https://shop.example/%73earch?q=shirt',
    'https://shop.example/%FF',
  ])
    expect(shoppingPageKind(url), url).toBe('excluded');
  for (const url of [
    'https://shop.example/collections/shirts/products/blue-shirt',
    'https://shop.example/us/blue-shirt-p123.html',
    'https://shop.example/dp/B123',
    'https://shop.example/product/blue-shirt',
  ])
    expect(shoppingPageKind(url)).toBe('product-path');
  expect(shoppingPageKind('https://shop.example/blue-shirt.html')).toBe('unknown');
  expect(shoppingPageKind('https://pinterest.com.shop.example/blue-shirt')).toBe('unknown');
  expect(
    groundedListings(
      {
        listings: [
          { sourceIndex: 0, match: 'similar', reason: 'AI selected a collection by mistake.' },
        ],
        note: '',
      },
      [{ title: 'Shirts', url: 'https://shop.example/collections/shirts' }],
      null,
    ),
  ).toEqual([]);
});

test('retailer product evidence ranks first, keeps relevance ties, and rejects category redirects', () => {
  const listing = (title: string, path: string): ShoppingResult['listings'][number] => ({
    title,
    url: `https://shop.example${path}`,
    retailer: 'shop.example',
    match: 'similar',
    reason: 'Similar collar; identity unverified.',
  });
  const unknown = listing('Unknown path', '/blue-shirt.html');
  const direct = listing('Direct path', '/products/blue');
  const evidence = {
    availability: 'unknown' as const,
    checkedAt: '2026-09-12T12:00:00Z',
    sourceUrl: 'https://shop.example/shirt.html',
    productName: 'Shirt',
    note: 'Multiple offers.',
  };
  const supported = { ...listing('Metadata', '/shirt.html'), evidence };
  const supportedSecond = {
    ...listing('Metadata second', '/shirt-2.html'),
    evidence: { ...evidence, sourceUrl: 'https://shop.example/shirt-2.html' },
  };
  const redirected = {
    ...listing('Redirected', '/products/removed'),
    evidence: { ...evidence, sourceUrl: 'https://shop.example/collections/shirts' },
  };
  const input = [unknown, direct, supported, redirected, supportedSecond];
  const result = prioritizeShoppingListings(input);
  expect(result.map((item) => item.title)).toEqual([
    'Metadata',
    'Metadata second',
    'Direct path',
    'Unknown path',
  ]);
  expect(input[0]).toBe(unknown);
  expect(result.every((item) => item.match === 'similar')).toBe(true);
  expect(result[0].evidence?.availability).toBe('unknown');
});

test('a product identifier for another page cannot supply stock evidence', () => {
  const product = {
    '@type': 'Product',
    '@id': 'https://shop.example/products/other#product',
    name: 'Another shirt',
    offers: {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      price: '20',
      priceCurrency: 'USD',
    },
  };
  const html = (value: unknown) =>
    `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
  const source = 'https://shop.example/products/shirt';
  expect(parseProductEvidence(html(product), source)).toMatchObject({ availability: 'unknown' });
  expect(parseProductEvidence(html(product), source).productName).toBeUndefined();
  expect(
    parseProductEvidence(html({ ...product, '@id': source + '#product' }), source),
  ).toMatchObject({ availability: 'in-stock', price: 20 });
});
