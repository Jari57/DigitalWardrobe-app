import type { DetectedItem, ShoppingResult } from './discovery';
type Listing = ShoppingResult['listings'][number];
const code = (value?: string | null) => (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const brand = (value?: string | null) => (value ?? '').trim().toLowerCase();

export function verifiedIdentityEvidence(item: DetectedItem, listing: Listing) {
  const observed = code(item.visibleModelCode);
  return observed.length >= 5 &&
    /[0-9]/.test(observed) &&
    item.readableText?.some((text) =>
      text
        .toUpperCase()
        .split(/[^A-Z0-9-]+/)
        .some((token) => code(token) === observed),
    ) &&
    observed === code(listing.evidence?.modelCode) &&
    !!brand(item.visibleBrand) &&
    brand(item.visibleBrand) === brand(listing.evidence?.brand) &&
    listing.visualReview?.status === 'consistent'
    ? ('matching-code-and-visuals' as const)
    : ('unverified' as const);
}

export function matchVerdict(item: DetectedItem, listing: Listing) {
  if (listing.visualReview?.status === 'different')
    return {
      tier: 0,
      label: 'Conflicting match',
      note: 'The product photo conflicts with the reference.',
    };
  if (verifiedIdentityEvidence(item, listing) === 'matching-code-and-visuals')
    return {
      tier: 3,
      label: 'Model code + visuals match',
      note: 'Readable reference code and brand match retailer metadata, and visible details agree. Confirm the exact variant with the retailer.',
    };
  const conflict =
    !!code(item.visibleModelCode) &&
    !!code(listing.evidence?.modelCode) &&
    code(item.visibleModelCode) !== code(listing.evidence?.modelCode);
  if (conflict)
    return {
      tier: 1,
      label: 'Alternative · different model',
      note: 'The retailer model code differs from the reference. This is not an exact match.',
    };
  if (['consistent', 'similar'].includes(listing.visualReview?.status ?? ''))
    return {
      tier: 2,
      label: 'Visually similar',
      note:
        listing.visualReview!.note ||
        'Visible details are similar; product identity is unconfirmed.',
    };
  return {
    tier: 1,
    label: 'Search lead · needs checking',
    note: 'There is not enough photo evidence to verify this match. Check the retailer images before buying.',
  };
}

export function verifiedListings(item: DetectedItem, listings: Listing[]): Listing[] {
  return listings
    .map((listing, index) => ({ listing, index, verdict: matchVerdict(item, listing) }))
    .filter(({ verdict }) => verdict.tier > 0)
    .sort((a, b) => b.verdict.tier - a.verdict.tier || a.index - b.index)
    .map(({ listing }) => ({
      ...listing,
      identityEvidence: verifiedIdentityEvidence(item, listing),
      match:
        verifiedIdentityEvidence(item, listing) === 'matching-code-and-visuals'
          ? 'possible-exact'
          : 'similar',
    }));
}
