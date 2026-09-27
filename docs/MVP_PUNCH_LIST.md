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

## 2. Finance and investor evidence

- [x] Separate observed activity from financial assumptions at `/admin/investors`.
- [x] Show in-app MRR/ARR as zero while billing is off; label CAC, LTV, runway and revenue CAGR as unestablished without their required records.
- [x] Compare retained signups across completed 30-day windows; never annualize a short history into a revenue CAGR.
- [x] Provide a blank-input scenario calculator for MRR/ARR, CAC, gross-profit LTV, payback and runway. Inputs stay in page memory and never enable billing.
- [x] Provide an administrator-only dated JSON evidence export with definitions, sources and limitations; exclude usernames, images, prompts and scenario inputs.
- [ ] Reconcile complete marketing, hosting, tools, labor, cash and revenue records before claiming actual burn, runway, margins or CAC.
- [ ] Classify internal/test accounts and add acquisition attribution plus matured D7/D30 cohorts before treating account counts as external-customer traction.
- [ ] Establish paid-cohort retention and recurring-contract evidence if monetization is later authorized. Billing remains off now.

Definitions and evidence requirements: [recurring revenue](https://stripe.com/resources/more/how-to-use-monthly-recurring-revenue-mrr-and-annual-recurring-revenue-arr-to-guide-growth), [SaaS metrics](https://stripe.com/resources/more/essential-saas-metrics). Current exports are operational snapshots, not audited financial statements. Cost per signup is not paid-customer CAC, repeat-day activity is not cohort retention, and a hypothetical ARR is not actual ARR.

## 3. Shopping quality

- [ ] Expand the permissioned known-item benchmark across garment types, screenshots, lookalikes and supported countries.
- [ ] Improve direct retailer retrieval; distinguish a product-identification page from a local purchasable listing.
- [ ] Evaluate an image-retrieval/catalog provider inside an agreed budget before buying a subscription.
- [ ] Track real image-load success and independently reviewed exact/alternative labels, rather than treating metadata or agent confidence as truth.

Acceptance: frozen evaluation inputs, useful photo results and local links, no unsupported exact claims, failures retained in the report. Current two-case baseline and runner are in `SHIPATON_READINESS.md`.

## 4. Discovery freshness

- [ ] Select a permitted social-data source and define coverage/cost.
- [ ] Store timestamped observations and connect the existing rising-fit scorer.
- [ ] Validate freshness, duplicates, creator diversity and relevance before showing a viral label.

Acceptance: a refresh delivers eligible fresh items; every viral claim has observed source evidence. Current feed is editorial, not a connected social trend monitor.

## 5. Reliability and usability

- [ ] Verify critical journeys on physical iOS and Android devices, plus desktop; include poor connectivity and upload failures.
- [ ] Connect and acknowledge operational alert delivery; add independent uptime/dead-cron monitoring and durable delivery status.
- [ ] Repeat recovery against the current nine-migration schema and exercise isolated application flows. The September 20 isolated SQL restore already passed with seven migrations; it did not test app cutover. Recheck the previously recorded six-hour recovery window.
- [ ] Add source-specific monitoring and agent latency instrumentation if current outcome/cost signals show problems.
- [ ] Improve admin account search/pagination when the first 50-row activity view is insufficient.

## 6. Submission package

- [x] Draft pitch, demo storyboard and eligibility checklist.
- [ ] Confirm the actual competition/category and its compatibility with billing staying off.
- [ ] Record actual functionality with permissioned images; prepare required icon and screenshots.
- [ ] Finish any platform-specific eligibility work only after the entry route is confirmed.
- [ ] Review and submit the completed entry.

RevenueCat integration/store eligibility remains unresolved. The earlier monetization recommendation is not authorization to enable billing; the latest product decision overrides it.

## Release evidence

Code release `b599a92`, deployed as `dpl_4fFoQLQkakMNahrJrDwe173Dw2gQ`. Twenty-eight agent/admin checks passed, plus the read-only production database gate and desktop/mobile rendering check. The live owner session loaded the dashboard and saved the existing $1/day, 10-actions/account settings with an audit entry. Billing remained off. A temporary ordinary account was denied admin-page/control access and deleted after live checks. One synthetic traffic view remains in the aggregate as verification traffic. The 7-day filter showed the new count. No live AI pause was performed; fail-closed enforcement is covered by automated tests.

The initial 30-day owner view showed 27 retained completed searches, 10 without links, and four failing feed sources (Who What Wear, Hypebeast, GQ, Vogue). These are a snapshot of retained records, not a held-out quality benchmark. Investigate these source failures and direct retailer coverage next.

## Parallel review: narrowed remaining work

Three specialist reviews covered matching/photos, editorial sources, and release evidence. Safe fixes prepared in this review: same-product ImageObject/contentUrl and backup metadata images, verified GQ/Vogue RSS endpoints, a bounded 4 MB allowance only for Who What Wear, and operations checks covering every agent and the administrator's lowered daily cap. Automated regression checks do not establish production matching accuracy or alert delivery.

Work in this order:

1. **Shopping resilience implemented:** try up to eight backup photos until three usable images are found; preserve qualified unverified alternatives when optional visual review fails, retaining an unknown-cost budget hold; re-resolve expired saved-photo metadata once through the existing safe owner-scoped path. Regression coverage includes failed photos, invalid provider output, failed replacement and ownership rejection.
2. **Retrieval quality:** connect an authorized image/catalog retrieval source within an agreed budget and evaluate held-out screenshots. Current retrieval is text-based; visual verification cannot find a candidate missing from search. Keep exact-label evidence strict.
3. **Viral discovery:** acquire permitted timestamped social observations, then connect scoring. Editorial RSS repair is not proof of virality.
4. **Operational acceptance:** acknowledge support/alert test messages, verify independent outage detection, rehearse current-schema application recovery, and complete physical iOS/Android journeys.
5. **Submission evidence:** confirm competition/category, record permissioned demo assets, and resolve applicable store requirements while retaining billing off. Actual financial metrics require actual financial records.

Owner-access regression checks found no new authorization defect. Existing production access remains the verified Google identity `jari57@gmail.com`; an alternate spelling must not silently grant access. Historical restore evidence is in `MVP_RELEASE_VERIFICATION.md`; physical-device gaps are in `PWA_VERIFICATION.md`. None of these checks constitute independent certification.

Release `4d107c8` was promoted as `dpl_AYQgU2ocDazcm3j9ubfTk739a8pN`. All 36 regression checks, TypeScript, production build and production database query gate passed. The live feed interaction test passed refresh, audience selection, likes, saves and hide/undo, then deleted its temporary account. Public health confirmed database ready and billing off. Post-release public feed reported GQ and Vogue available, with five and four returned items respectively; Who What Wear and Hypebeast still reported unavailable in the production refresh despite successful local source checks. Their production fetch reliability remains open; do not mark all source failures resolved.

## Demo-focused execution

The landing upload action now opens the file picker directly; selection stays local until explicit identification. A detected-piece shortcut starts only that piece's search. Owned garments can be reviewed, saved and opened in styling with one submit and one wardrobe refresh; no styling generation runs automatically. Failed refresh never repeats an already committed save. The submission storyboard ends with saved-outfit persistence, not an unauthorized purchase flow.

Validation: 41 agent/security checks, 20 browser UX checks, TypeScript and optimized production build passed. Browser checks cover guest-photo retention through sign-in, privacy cleanup on sign-out, one-piece search isolation, visual shopping results, save-and-style locking and no automatic AI generation. These checks are not a new matching benchmark. Next matching work still requires an authorized image/catalog source, broader permissioned reference fixtures and actual held-out outcomes. Event/category confirmation and physical-device acceptance remain open.

Production code `d5dd81d` promoted as `dpl_5LXpTaGFDzbZ9MVZteytj1hbRRoh`. The remote 41-check gate and production database check passed. Live guest verification opened the hero file picker with zero discovery calls, confirmed no 390px horizontal overflow, and returned healthy database/billing-off status. Desktop/mobile screenshots were inspected. The optional retrieval experiment is documented separately in `IMAGE_RETRIEVAL_PILOT.md`; it is not connected to customer traffic.
