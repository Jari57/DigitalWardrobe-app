'use client';
import { useState } from 'react';
import { ArrowUpRight, ImageOff } from 'lucide-react';
import { shoppingItem, type DetectedItem, type ShoppingResult } from '@/lib/discovery';
import { matchVerdict } from '@/lib/match-verifier';
import { matchesGarmentKind } from '@/lib/shopping-quality';
import { api } from './ui';

function ProductCard({
  listing,
  searchId,
  verdict,
}: {
  listing: ShoppingResult['listings'][number];
  searchId: string;
  verdict: ReturnType<typeof matchVerdict>;
}) {
  const [photo, setPhoto] = useState<'loading' | 'ready' | 'missing'>('loading');
  const source = `/api/discovery/photo?${new URLSearchParams({ search: searchId, item: listing.url })}`;
  return (
    <a
      className="shopping-card"
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Shop ${listing.title} at ${listing.retailer}`}
      onClick={() => {
        void api('/api/journey', 'POST', { event: 'retailer_click' }).catch(() => {});
      }}
    >
      <div className={`shopping-card-photo is-${photo}`}>
        {photo !== 'missing' && (
          <img
            src={source}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            onLoad={() => setPhoto('ready')}
            onError={() => setPhoto('missing')}
          />
        )}
        {photo === 'missing' && (
          <span className="shopping-photo-missing">
            <ImageOff size={26} aria-hidden="true" />
            <span>Photo unavailable</span>
          </span>
        )}
        <span className={`shopping-card-badge${verdict.tier === 3 ? ' is-exact' : ''}`}>
          {verdict.tier === 1 ? 'Search lead' : verdict.label}
        </span>
        <span className="shopping-card-arrow" aria-hidden="true">
          <ArrowUpRight size={19} />
        </span>
      </div>
      <div className="shopping-card-caption">
        <span className="shopping-card-retailer">{listing.retailer.replace(/^www\./, '')}</span>
        <strong>{listing.title}</strong>
        {verdict.tier >= 2 && <small>{verdict.note}</small>}
        <span className="shopping-card-cta">
          Shop this piece <ArrowUpRight size={14} aria-hidden="true" />
        </span>
      </div>
    </a>
  );
}

export default function ShoppingResults({
  item,
  result,
  listings,
}: {
  item: DetectedItem;
  result: ShoppingResult;
  listings: ShoppingResult['listings'];
}) {
  const target = shoppingItem(item, result.searchContext?.description);
  const entries = listings
    .filter((listing) => matchesGarmentKind(target, listing))
    .map((listing) => ({ listing, verdict: matchVerdict(target, listing) }))
    .filter(({ verdict }) => verdict.tier > 0)
    .sort((a, b) => b.verdict.tier - a.verdict.tier);
  const checked = entries.filter(({ verdict }) => verdict.tier >= 2);
  const leads = entries.filter(({ verdict }) => verdict.tier === 1);
  const cards = (items: typeof entries) => (
    <div className="shopping-results-grid">
      {items.map(({ listing, verdict }) => (
        <ProductCard key={listing.url} listing={listing} searchId={result.id} verdict={verdict} />
      ))}
    </div>
  );
  return (
    <div className="stack" aria-label={`Shopping results for ${item.name}`}>
      {checked.length > 0 ? (
        cards(checked)
      ) : (
        <p role="status">
          {result.searchContext?.description
            ? 'These results use your edited description. Check retailer photos for a visual match.'
            : 'No close visual match was verified. Try a photo showing just this piece.'}
        </p>
      )}
      {leads.length > 0 && (
        <details className="search-details" open={checked.length === 0 || undefined}>
          <summary>
            {leads.length} search {leads.length === 1 ? 'lead' : 'leads'} to check
          </summary>
          {cards(leads)}
        </details>
      )}
    </div>
  );
}
