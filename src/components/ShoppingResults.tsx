'use client';
import { useState } from 'react';
import { ArrowUpRight, ImageOff } from 'lucide-react';
import type { DetectedItem, ShoppingResult } from '@/lib/discovery';
import { matchVerdict } from '@/lib/match-verifier';
import { api } from './ui';

function ProductCard({
  listing,
  searchId,
  exact,
}: {
  listing: ShoppingResult['listings'][number];
  searchId: string;
  exact: boolean;
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
        <span className={`shopping-card-badge${exact ? ' is-exact' : ''}`}>
          {exact ? 'Match found' : 'Alternative'}
        </span>
        <span className="shopping-card-arrow" aria-hidden="true">
          <ArrowUpRight size={19} />
        </span>
      </div>
      <div className="shopping-card-caption">
        <span className="shopping-card-retailer">{listing.retailer.replace(/^www\./, '')}</span>
        <strong>{listing.title}</strong>
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
  return (
    <div className="shopping-results-grid" aria-label={`Shopping results for ${item.name}`}>
      {listings.map((listing) => (
        <ProductCard
          key={`${result.id}:${listing.url}`}
          listing={listing}
          searchId={result.id}
          exact={matchVerdict(item, listing).tier === 3}
        />
      ))}
    </div>
  );
}
