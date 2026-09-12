# Digital Wardrobe — delivery plan and punch list

Updated September 12, 2026. Owner: implementation in this task; product decisions follow the priorities below. Preserve the cream/charcoal/fuchsia design. Stripe is the only intentionally deferred launch integration. A checked item means verified work, not a promise of universal accuracy or virality.

## Objective

Deliver a reliable creator wardrobe studio: real photo → identified pieces → owned closet or sourced shopping options → an intentional outfit → an exportable creator asset. Release the app only when the complete journey, privacy boundaries, recovery behavior and mobile experience pass the acceptance checks. Growth features support sharing; viral reach is not an engineering guarantee.

## Verified baseline

- [x] Private accounts, recovery codes, password changes and account deletion.
- [x] Owner-scoped image uploads, garment editing and persistence.
- [x] Real Gemini clothing detection, including shirt, bomber jacket and no-clothing evaluation.
- [x] Perplexity-backed shopping results with source-derived URLs and uncertainty labels.
- [x] Random Blind Fit, locking, canvas placement, saved looks and PNG export.
- [x] Transactional AI request ledger, result reuse, usage accounting and daily allowances.
- [x] Protected hosted preview with 16 passing checks for the photo-to-shopping flow.
- [ ] Full original-prototype/spec parity audit. Existing checkmarks do not establish complete product parity.

## Batch 1 — AI Blind Fit (verified preview)

- [x] Keep Random Reveal available and clearly labeled; add a separate AI styling action.
- [x] Add occasion and aesthetic controls with sensible defaults.
- [x] Send at most 40 owner-scoped garment descriptions, categories and colors. Explain that this initial stylist uses saved details, not visual inspection of every photo.
- [x] Preserve every locked garment; reject unknown IDs, duplicates and invalid locks server-side.
- [x] Handle incomplete closets honestly; never invent a missing piece or label randomness as an AI result.
- [x] Return a short explanation and limitations; user accepts before canvas placement or saving.
- [x] Reuse identical results for unchanged input; count AI actions against existing shared allowances.
- [x] Test real provider selection, lock preservation, empty closet, missing category, malformed result, cross-account access, budget exhaustion and canvas handoff. Budget exhaustion is covered by the ledger test and UI error substitution; hosted validation uses a real provider.
- [x] Deploy and verify the hosted route before advertising it as available.

Acceptance: a user locks a piece, chooses an occasion, receives an explanation and an outfit composed solely of owned IDs, and opens exactly those pieces on the canvas. Failed generation preserves the previous selection.

## Batch 2 — Complete Look Spotter

- [x] Match visible elements in an inspiration photo against owned garments using explicit candidate limits.
- [x] Distinguish owned matches, approximate substitutions and missing pieces.
- [x] Let the user accept/edit pairings and send the resulting look to canvas.
- [x] Send missing pieces to shopping discovery without disclosing the full closet.
- [x] Test sparse closets, real shirt matching, cached reuse, blank photo, ownership rejection, manual edits and canvas handoff; fixture-test the missing-piece shopping handoff.
- [ ] Broaden real-photo evaluation to multi-piece outfits and difficult substitute choices.

Acceptance: recreating inspiration produces traceable owned-piece pairings, never an invented similarity percentage.

## Batch 3 — Shopping quality and availability

- [ ] Rank direct product pages above category, editorial and social pages.
- [ ] Add safe retrieval or a product-data provider for product identity, variants and stock; bound requests, redirects and timeouts and block private-network destinations.
- [ ] Distinguish possible exact identity from verified product identity. Require evidence such as a visible label/model identifier plus matching product details for stronger claims.
- [ ] Display verified availability with source and check time; use Unknown if retrieval fails. Exclude known sold-out results from available-only views.
- [ ] Improve regional relevance and distinguish search region from confirmed shipping availability.
- [ ] Test dead links, redirects, sold-out variants, changed prices, blocked retailers and stale results.

Acceptance: every identity, price or stock claim has attributable evidence and a freshness timestamp. Unknown data never becomes a confident claim.

## Batch 4 — Garment cutouts

- [ ] Evaluate a segmentation provider against quality, per-image price, privacy and commercial-use requirements.
- [ ] Isolate selected garments in multi-piece photos; keep the original image.
- [ ] Add preview, accept/reject and an original-photo fallback.
- [ ] Store cutouts privately and reuse them across closet, Blind Fit and canvas.
- [ ] Test dark clothing, transparent fabrics, overlapping garments, hair/skin boundaries and deletion.

Acceptance: accepted transparent cutouts render correctly in the canvas and exported PNG; failed segmentation cannot destroy the original.

## Batch 5 — Monthly Top 10 trends

- [ ] Create a region-specific monthly edition with a shared persisted cache and a bounded refresh budget.
- [ ] Research dated primary/credible fashion sources. Store sources, edition month and refresh time with every result.
- [ ] Present a curated selection unless evidence supports a quantitative ranking; never invent TikTok metrics or growth percentages.
- [ ] Add premium cards with trend name, why it matters, evidence, shopping action and recreate-with-my-closet action.
- [ ] If fewer than ten trends have evidence, show the supported number rather than filling with fabricated content.
- [ ] Keep a clearly dated previous edition during provider outages; prevent refresh stampedes.

Acceptance: repeated visitors do not trigger repeated research charges; every displayed trend has dated supporting evidence.

## Batch 6 — Creator assistant and feedback

- [ ] Generate editable captions and filming steps from a saved outfit and selected tone.
- [ ] Avoid unsupported trend claims and automatic external posting.
- [ ] Carry user-approved content into existing preview/export controls.
- [ ] Capture helpful/not-helpful feedback tied to a generation and prompt version, with a deletion policy.
- [ ] Version prompts, evaluation cases, lock rules and composition rules as the app's maintained product logic.

Acceptance: creator output references the real saved outfit; users edit and choose whether to share.

## Batch 7 — AI recovery and operating costs

- [ ] Persist generation IDs and reconcile uncertain holds, including partial multi-stage search failures.
- [ ] Support deliberate safe retry after transient failure without duplicate billing or forcing a wait until tomorrow.
- [ ] Separate test/preview accounting from customer budgets while retaining an overall spend limit.
- [ ] Expose remaining allowance and useful error states; prevent repeated unproductive requests.
- [ ] Configure provider-level budgets and notifications alongside the app ledger.
- [ ] Verify deletion during in-flight work, concurrent requests, expired sessions and account recreation abuse.

Acceptance: a timeout does not silently refund unknown spend, lose an available result, or permit an unbounded retry loop.

## Batch 8 — PWA and real devices (after feature and polish work)

- [ ] Add manifest, appropriate app icons and install affordance.
- [ ] Choose an offline policy that never caches private API responses across accounts; explain unavailable AI/network actions.
- [ ] Verify service-worker update behavior and storage cleanup on sign-out.
- [ ] Test iPhone Safari and Android Chrome uploads, install flow, keyboard layout and native sharing.
- [ ] Check touch targets, contrast, keyboard focus, screen-reader labels and reduced motion.

Acceptance: installation and updates work on actual devices; private wardrobe data cannot leak through shared caches.

## Batch 9 — Premium polish and reliability

- [x] Add skippable creator quick start: vibe selection, real-photo import, Blind Fit and outfit-card handoff. Preferences are session-local; onboarding ends after the first saved look.
- [x] Add light, dark and system themes; persist theme preference on this browser and follow device changes in system mode.
- [x] Verify onboarding skip/reopen, theme reload persistence and 320px width; inspect light/dark mobile screenshots.
- [ ] Complete signed-in dark-mode review of all remaining dialogs and actual-phone behavior.

- [ ] Review loading/empty/error states, consistent typography, card spacing and mobile navigation.
- [ ] Resolve incomplete wardrobes, failed images, duplicate saves and overlapping canvas pieces.
- [ ] Audit premium feature entitlements and enforcement; do not claim a payment integration exists before Stripe is connected.
- [ ] Review upload/storage limits, database indexes, logs without secrets, dependency risks and restore procedure.
- [ ] Establish a small repeatable real-photo evaluation set and measure detection quality, match relevance, latency and cost per successful action.

Acceptance: supported journeys have no unresolved blocker/high-severity defects; quality and known limitations are documented.

## Batch 10 — Launch audit and release

- [ ] Map every original feature/spec item to implemented, intentionally changed, deferred or missing, with evidence.
- [ ] Run the complete new-user journey and a returning-user journey on the candidate deployment.
- [ ] Confirm authentication, cross-account isolation, deletion, AI limits, source attribution and native-device checks.
- [ ] Record release commit, environment configuration, rollback target and remaining limitations.
- [ ] Integrate Stripe LAST, after feature acceptance, premium polish, PWA and the prebilling release audit. Test checkout, entitlements, webhooks, cancellation and failure recovery in test mode before any live payments.
- [ ] Promote the verified candidate to production only once launch scope is satisfied.

## Execution and cost discipline

Work one bounded batch at a time; no background development agents or automatic paid retries. Reuse the tested Gateway integration. Keep the current $1/day preview app budget and 10 AI actions/account/day unless explicitly changed. Run targeted checks after changes, with live provider calls reserved for meaningful acceptance tests. Mark a batch complete only after its evidence exists; do not translate a planned feature into a shipped claim. External provider spend controls and actual charges must be checked separately from estimated reservations.

## Immediate order

AI Blind Fit → owned-closet Look Spotter → shopping evidence → cutouts → monthly trends → Creator assistant. Then finish creator onboarding/premium polish and recovery controls → PWA and real-device checks → prebilling release audit → Stripe LAST → final release verification. Recovery/cost fixes can move earlier when they block safe testing. After each batch update this checklist, push the branch, publish a protected preview and state what is actually testable.

## Current batch evidence

- Production build and TypeScript pass.
- Agent contracts and transactional ledger checks: 5 passed. Existing creator journey regression: passed after UI changes.
- Real Gemini stylist test: owned selection, lock preservation, server-side rejection of another account’s IDs, duplicate request reuse, failure preserving selection and canvas handoff passed.
- Creator quick start / theme browser check passed, including empty-closet Blind Fit, import entry, skip/reopen, persisted light mode, dark mode, system changes and narrow viewport.
- Hosted preview: https://digital-wardrobe-h3kix5wlp-almonjs-projects.vercel.app (runtime 3ac2d9d). Twelve hosted checks passed, including live one-piece styling, preservation of its lock, missing-category limitations, cached reuse, private accounts and persistence.
- PWA, Stripe and unchecked feature batches remain unfinished; this is not a production-readiness certification.

## Look Spotter delivery evidence

Photo-to-owned-substitute matching implemented using one photo and at most 40 owned metadata candidates, with explicit consent copy, shared budget ledger and no automatic retry. Owned photographs are not compared in this version. Pairings can be edited and saved; missing pieces open the original photo in discovery for user-initiated identification/search. Production deployment 66d0a39 is live at https://digital-wardrobe-app-vert.vercel.app. Ten public production checks passed, including live matching, cache reuse, pair persistence and cleanup. Five targeted tests passed (contracts, creator regression, live Spotter flow). Domain/name selection is deferred at the owner’s request.
