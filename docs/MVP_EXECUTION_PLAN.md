# FitStalker MVP execution plan

Updated September 20, 2026. Fashion discovery and wardrobe product. This sequence supersedes the historical ordering in DELIVERY_PUNCH_LIST.md, not its recorded limitations. Work in bounded batches; Stripe last, cutouts internal, no automatic paid retries or background agents.

## 1. Screenshot to useful result — first batch

- [x] Add direct navigation to each identified piece without a provider call.
- [x] Keep failed shopping messages next to the affected piece and shopping region.
- [x] Offer a direct way to remove an in-stock filter that hides every result.
- [x] Reopen the latest private scan without generating again.
- [x] Prevent refresh failure after a successful closet save from presenting the save as failed.
- [x] Remove duplicated inspiration photos after identification.
- [x] Verify production build, formatting, and four browser checks: scoped failures, free resume/navigation, save-refresh recovery, and existing screenshot/sign-out flows. No paid provider calls.
- [ ] Publish and verify the batch on fitstalker.com.
- [ ] Add editable search descriptions with validated, owner-scoped inputs and distinct cache keys. User corrections must never imply verified branding.
- [ ] Restore persisted shopping results when reopening scans, with source and freshness labels.
- [ ] Implement deliberate retry only for backend states proven safe; preserve uncertain budget holds and prevent duplicate dispatch.
- [ ] Evaluate a small real-photo set for detection, shopping relevance, empty results, latency and cost. Record misses and limitations.

Acceptance: a user selects a piece, receives evidence-qualified results or an actionable failure, retains their scan, and saves successfully without duplicate writes caused by refresh failure.

## 2. Connect inspiration and closet styling

- [ ] Make saved For You inspiration easy to reopen and identify.
- [ ] Add an explicit closet handoff after saving an owned piece.
- [ ] Add “Style with my closet” using saved owned IDs and existing styling tools.
- [ ] Preserve selected inspiration across sign-in and navigation; clear private content on sign-out.
- [ ] Verify reload persistence, ownership isolation and empty-closet alternatives.

Acceptance: discovery leads to a saved piece or inspiration and then to an editable outfit without re-uploading the same photo or inventing owned items.

## 3. Lightweight personalization and return visits

- [ ] Extend existing account preferences with region, optional budget and size preferences.
- [ ] Validate and persist preferences per account; include deletion and cross-account tests.
- [ ] Apply region and budget transparently. Never imply size stock or delivery eligibility is verified.
- [ ] Add a compact resume area for recent scans, saved inspiration and unfinished looks; keep upload prominent.
- [ ] Keep onboarding skippable and preferences editable.

Acceptance: preferences survive sign-in and reload, influence the relevant action, and cannot leak between accounts.

## 4. Release verification and measurement

- [ ] Measure upload, completed identification, useful result, retailer click/save and return journeys without private image contents or descriptions in analytics.
- [ ] Check production errors and establish alerts with a tested destination.
- [ ] Verify working support mailbox/forwarding and delivery.
- [ ] Confirm backup retention and perform isolated restore rehearsal.
- [ ] Confirm provider spending controls and alerts.
- [ ] Owner completes Google login and verifies administrator access.
- [ ] Physical iPhone and Android: uploads, install, native sharing, keyboard, themes, update with unsaved work.
- [ ] Verify account deletion, expired sessions, safe retries and allowance recovery.
- [ ] Record release commit, rollback deployment and remaining limitations.

Acceptance: complete new and returning user journeys on the release candidate; document real-device evidence and operational recovery, not percentage-based readiness claims.

## After initial MVP feedback

- [ ] Useful saved-look suggestions and fresh personalized discoveries.
- [ ] Optional notifications only for meaningful content, with consent and unsubscribe controls.
- [ ] Define paid value and economics from actual usage; then implement Stripe and test entitlements, cancellation and webhook recovery.

Deferred: gamified streaks/achievements, extra agent personas, large dashboards, guaranteed exact matching, verified TikTok momentum and customer-facing garment cutouts.
