# FitStalker launch punch list

Priority updated September 27, 2026. Customer billing stays off. Do not connect purchases, create paid products or start charging as part of this list.

## 1. Owner control room — deployed and verified

- [x] Admin-only overview with 7/30/90-day ranges and manual refresh.
- [x] Cookieless page views by UTC day, page, referral channel and device; signed-in status is aggregated, not a visitor identity.
- [x] Registered usernames, account creation, last recorded activity, AI use and recorded costs. Show up to 50 recently active accounts.
- [x] Agent requests by outcome, tokens, settled costs, today's reserved budget, and recent request activity without prompts or images.
- [x] Shopping coverage: empty searches, returned listings, photo metadata coverage and exact labels. Keep these distinct from independently evaluated accuracy.
- [x] Existing feature action counts, closet/outfit totals and feed refresh failures.
- [x] Audited AI pause/resume and lower daily spending/action limits; deployment ceilings remain authoritative. No billing control is exposed.
- [x] Cross-origin, non-admin, stale-version, overspend, privacy-signal and fail-closed tests.
- [x] Verify migrated production queries, live owner page, date filtering, unchanged-limit save/audit, and ordinary-user access rejection. Desktop/mobile/dark layout also passed fixture rendering checks.

Acceptance: the owner opens `/admin` through their verified Google administrator login, sees real data, and ordinary users cannot view or change it. An administrative pause blocks new generation requests; in-flight requests can finish. Reconciliation may still settle previously dispatched usage.

Measurement boundaries: no historical anonymous traffic can be reconstructed. Page views are not unique visitors. Referral/device categories are approximate and client-reported; DNT/GPC and blocked scripts reduce coverage. Account daily action counters are currently pruned after 30 days, so a 90-day selection does not restore older counters. Agent records disappear with deleted accounts; the global spending ledger remains. No raw IPs, referrer URLs, browser fingerprints or search content are stored by the new traffic collector. Hosting logs are separate. Aggregate traffic is pruned after 90 days when collection next runs.

## 2. Shopping quality — next product priority

- [ ] Expand the permissioned known-item benchmark across garment types, screenshots, lookalikes and supported countries.
- [ ] Improve direct retailer retrieval; distinguish a product-identification page from a local purchasable listing.
- [ ] Evaluate an image-retrieval/catalog provider inside an agreed budget before buying a subscription.
- [ ] Track real image-load success and independently reviewed exact/alternative labels, rather than treating metadata or agent confidence as truth.

Acceptance: frozen evaluation inputs, useful photo results and local links, no unsupported exact claims, failures retained in the report. Current two-case baseline and runner are in `SHIPATON_READINESS.md`.

## 3. Discovery freshness

- [ ] Select a permitted social-data source and define coverage/cost.
- [ ] Store timestamped observations and connect the existing rising-fit scorer.
- [ ] Validate freshness, duplicates, creator diversity and relevance before showing a viral label.

Acceptance: a refresh delivers eligible fresh items; every viral claim has observed source evidence. Current feed is editorial, not a connected social trend monitor.

## 4. Reliability and usability

- [ ] Verify critical journeys on physical iOS and Android devices, plus desktop; include poor connectivity and upload failures.
- [ ] Connect and test operational alert delivery and run a documented backup restore drill.
- [ ] Add source-specific monitoring and agent latency instrumentation if current outcome/cost signals show problems.
- [ ] Improve admin account search/pagination when the first 50-row activity view is insufficient.

## 5. Submission package

- [x] Draft pitch, demo storyboard and eligibility checklist.
- [ ] Confirm the actual competition/category and its compatibility with billing staying off.
- [ ] Record actual functionality with permissioned images; prepare required icon and screenshots.
- [ ] Finish any platform-specific eligibility work only after the entry route is confirmed.
- [ ] Review and submit the completed entry.

RevenueCat integration/store eligibility remains unresolved. The earlier monetization recommendation is not authorization to enable billing; the latest product decision overrides it.

## Release evidence

Code release `b599a92`, deployed as `dpl_4fFoQLQkakMNahrJrDwe173Dw2gQ`. Twenty-eight agent/admin checks passed, plus the read-only production database gate and desktop/mobile rendering check. The live owner session loaded the dashboard and saved the existing $1/day, 10-actions/account settings with an audit entry. Billing remained off. A temporary ordinary account was denied admin-page/control access and deleted after live checks. One synthetic traffic view remains in the aggregate as verification traffic. The 7-day filter showed the new count. No live AI pause was performed; fail-closed enforcement is covered by automated tests.

The initial 30-day owner view showed 27 retained completed searches, 10 without links, and four failing feed sources (Who What Wear, Hypebeast, GQ, Vogue). These are a snapshot of retained records, not a held-out quality benchmark. Investigate these source failures and direct retailer coverage next.
