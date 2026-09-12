# Non-Stripe release audit — September 12, 2026

## Scope mapping

| Requested capability | Implementation and evidence | Limit |
| --- | --- | --- |
| Private working wardrobe | Accounts, recovery codes, uploads, editing, filters, saved looks, wear statistics; API isolation and browser lifecycle tests | Recovery uses a saved code, not email |
| Real photo recognition | Capture and inspiration matching use Gemini through Gateway; shirt, jacket, no-clothing and layered group-photo cases | At most six visible pieces; substitute matching uses saved garment descriptions, not every closet photo |
| Find clothing to buy | Bounded search, source-index ranking, direct product URL preference, retailer metadata and stock filter; live photo-to-save test | Similar alternatives, not guaranteed exact identity; size availability and delivery remain retailer-confirmed |
| Blind Fit | Random mode plus separate AI styling, mandatory locks, owned-ID checks, explanations and canvas handoff | Sparse closets produce partial outfits |
| Creator tools | Saved-look caption/filming draft, editing, private feedback, copy, 1080×1920 PNG and share preview | No automatic TikTok posting; edits must be copied/exported before closing |
| Monthly trends | Ten dated, sourced editorial cards; shopping and closet styling actions | US/UK-oriented manual monthly edition, not measured TikTok rankings or autonomous monitoring |
| Premium visual experience | Muted blush/charcoal, light/dark/system preference, skippable creator onboarding, enlarged touch controls, reduced motion | Final physical phone review remains open |
| PWA | Manifest, icons, optional install, public-only offline fallback, user-controlled updates | Native iOS/Android install/share checks remain open |
| Cost controls | Explicit user actions, ten/day allowance, $1/day shared cap, idempotency, provider receipts and conservative reconciliation | Partial or unknown dispatches cannot safely be refunded/retried automatically; provider-side notification settings unverified |
| Segmentation/cutouts | Internal evaluation only | Explicitly excluded from customer UI by owner |
| Branding/domain | Existing stable Vercel URL retained | Name/domain selection deferred by owner |
| Payments | Billing off | Stripe deliberately last; no paid entitlement is advertised |

## Operations review

- Uploads are decoded and re-encoded to WebP with EXIF removed: 4 MB input, 25-million-pixel decoder limit, 1,600px longest side, 3 MB normalized maximum. Account image count is limited to 1,500; this is a count cap, not a small total-byte quota.
- Photos and API responses are private and uncached. Service-worker cache contains only the public offline page and icons. Account deletion cascades through photos, looks, sessions, AI results and feedback. Aggregate spending reservations remain conservative.
- Owner-scoped indexes exist for wardrobe queries, image ownership, sessions and AI request history. Logs avoid request bodies, credentials and photographs. Retailer fetches validate public destinations and bound duration/body size.
- Formatting is repeatable through `npm run format:check`. Dependency installation reported zero audit vulnerabilities at this review; that is not a permanent security guarantee.
- Database migrations use a direct Neon endpoint, avoiding pooled session advisory locks. Runtime uses the existing pool. Migration 004 is additive and compatible with the prior app deployment.
- Rollback target before this batch: runtime `1e34e44`, Vercel deployment `dpl_G1ZwRhqvddU2VoYQCqxv84RESbRB`. Roll back the app without deleting newly added tables or user data.
- Database backup retention and a restore rehearsal have not been verified. A restore must first target an isolated database, validate row counts/relationships and test private account flows before any production switch. Do not overwrite production to test recovery.

## Remaining release gates

1. Physical iPhone Safari and Android Chrome: photo picker, install, keyboard, native file share and update with unsaved edits.
2. Wider clothing-quality evaluation, especially near-identical substitutes and difficult photos. No universal recognition or viral-growth claim.
3. Confirm provider-side spending alerts and database backup/restore coverage.
4. Broader retail coverage and region/variant evidence. Unknown fields remain explicitly unknown.

These gates prevent a claim that everything except Stripe is fully production-certified. The implementation is suitable for a controlled real-world trial once the candidate deployment checks pass.
