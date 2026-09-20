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
- [x] Publish ca47e0a and verify fitstalker.com, www.fitstalker.com and the original Vercel address report the matching version and healthy database. Inspect the live entry screen in the browser.
- [x] Add editable search descriptions with validated, owner-scoped inputs and distinct cache keys. User corrections must never imply verified branding.
- [x] Restore persisted shopping results when reopening scans, with source and freshness labels.
- [x] Implement deliberate retry only for backend states proven safe; preserve uncertain budget holds and prevent duplicate dispatch.
- [x] Evaluate a small real-photo set for detection, shopping relevance, empty results, latency and cost. Record misses and limitations.

Acceptance: a user selects a piece, receives evidence-qualified results or an actionable failure, retains their scan, and saves successfully without duplicate writes caused by refresh failure.

## 2. Connect inspiration and closet styling

- [x] Make saved For You inspiration easy to reopen and identify.
- [x] Add an explicit closet handoff after saving an owned piece.
- [x] Add “Style with my closet” using saved owned IDs and existing styling tools.
- [x] Preserve selected inspiration across sign-in and navigation; clear private content on sign-out.
- [x] Verify reload persistence, ownership isolation and empty-closet alternatives.

Acceptance: discovery leads to a saved piece or inspiration and then to an editable outfit without re-uploading the same photo or inventing owned items.

## 3. Lightweight personalization and return visits

- [x] Extend existing account preferences with region, optional budget and size preferences.
- [x] Validate and persist preferences per account; include deletion and cross-account tests.
- [x] Apply region and budget transparently. Never imply size stock or delivery eligibility is verified.
- [x] Add a compact resume area for recent scans, saved inspiration and unfinished looks; keep upload prominent.
- [x] Keep onboarding skippable and preferences editable.

Acceptance: preferences survive sign-in and reload, influence the relevant action, and cannot leak between accounts.

## 4. Release verification and measurement

- [x] Measure upload, completed identification, useful result, retailer click/save and return journeys without private image contents or descriptions in analytics.
- [ ] Check production errors and establish alerts with a tested destination.
- [ ] Verify working support mailbox/forwarding and delivery.
- [x] Confirm backup retention and perform isolated restore rehearsal.
- [x] Configure provider spending controls and alert thresholds; actual email delivery remains unverified.
- [x] Existing owner Google session verified on the live administrator page.
- [ ] Physical iPhone and Android: uploads, install, native sharing, keyboard, themes, update with unsaved work.
- [x] Verify account deletion, expired sessions, safe retries and allowance recovery.
- [x] Record release commit, rollback deployment and remaining limitations.

Acceptance: complete new and returning user journeys on the release candidate; document real-device evidence and operational recovery, not percentage-based readiness claims.

## After initial MVP feedback

- [ ] Useful saved-look suggestions and fresh personalized discoveries.
- [ ] Optional notifications only for meaningful content, with consent and unsubscribe controls.
- [ ] Define paid value and economics from actual usage; then implement Stripe and test entitlements, cancellation and webhook recovery.

Deferred: gamified streaks/achievements, extra agent personas, large dashboards, guaranteed exact matching, verified TikTok momentum and customer-facing garment cutouts.

## Release record

First batch runtime: ca47e0a. Local build, formatting and four focused browser regressions passed. Tests used provider fixtures and made no paid AI calls. Previous bare-domain rollback: digital-wardrobe-on0fhg4d8-almonjs-projects.vercel.app (8626b9d). Previous www alias: digital-wardrobe-pl8847955-almonjs-projects.vercel.app. Domain aliases were manually pinned and must be verified on each release. Backend retry safety, fresh provider quality and physical-device acceptance remain open.

Published deployment: digital-wardrobe-hi8s4oymb-almonjs-projects.vercel.app. All three public addresses now point to it. The prior premium visual polish (a1b880a) is included in this verified public release.


Full MVP implementation and operations evidence: see MVP_RELEASE_VERIFICATION.md. Remaining unchecked launch gates need support/alert delivery setup or physical devices; live Google owner access is verified. Photo evaluation is a small-case review, not a quality guarantee. No percentage readiness claim is made.



Final runtime: 883aff0; deployment digital-wardrobe-691xzav2i-almonjs-projects.vercel.app. All three public addresses verified healthy. Automatic production assignment restored, hourly cron registered and authenticated refresh succeeded. Full suite: 44 passed / 9 opt-in skipped, plus 23 HTTP checks and two separately successful real-photo evaluations. See MVP_RELEASE_VERIFICATION.md for exact evidence and limitations.

