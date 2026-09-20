# FitStalker MVP release verification — September 20, 2026

## Shipped scope

Fashion screenshot discovery, private closet and outfit creation remain the product scope. Search corrections now have validated private storage and separate cache identities; reopening scans restores shopping evidence without a new generation. Corrections never establish verified branding. A saved piece leads directly to the closet or a locked-piece styling session.

Optional shopping region, budget and sizes are saved per account. Preferences guide new searches; stock, exact identity, size availability and delivery remain retailer checks. The resume area opens saved inspiration, saved looks and explicitly saved canvas drafts. Selected screenshots survive tab navigation; logout clears private state.

Retries require an explicit user action. Only confirmed single-stage detection rejections with zero cost and no generation receipt can reserve again. Shopping failures, timeouts and ambiguous charges remain held. Concurrent retries cannot dispatch twice. Default empty preferences keep existing cache keys stable.

First-party daily counters measure visits, uploads, identifications, nonempty shopping results, retailer clicks, closet saves and service failures. They contain no photo, description, URL or IP data; account deletion cascades and cron removes records older than 30 days. Counts are actions, not a unique-user conversion funnel.

## Verification

- Production build and formatting passed; additive migration 202609200001_mvp_experience applied (7 migrations total).
- HTTP smoke suite passed 23 checks plus ownership, persistence, geometry, wear idempotency and recovery assertions.
- Mobile browser checks cover preferences, explicit draft save/reload/resume, corrected search restoration, closet handoff, themes and no horizontal overflow. Browser simulation is not physical-device certification.
- Real shirt photo: identification, three sourced similar listings, private save, reload and cached repeat passed in a 19.1-second end-to-end run. Stock was unknown for all listings. Results included EU/Israel locale paths for a US search, so regional eligibility and merchant quality are not guaranteed. No claim of an exact match.
- Layered group photo: 6 pieces, no guessed brands; appropriate denim jacket and white blouse selected from the owned closet; irrelevant gown and rain boots rejected; empty closet retained visible pieces with no invented owned IDs. Capture 6,299 ms/$0.001866; sparse match 5,151 ms/$0.001874; empty closet 5,856 ms/$0.001861. Total recorded cost $0.005601. This is two cases, not an accuracy benchmark.
- Earlier local live attempts encountered an expired Gateway credential and then blank protected variables in the downloaded development environment. Development authentication/settings were repaired; the successful live runs above followed. Production secrets were not changed.

## Operations and recovery

Neon dashboard access verified. Project winter-queen-31899625, main branch br-twilight-surf-aw9fwl8g, current history retention 6 hours. A historical data-and-schema branch was created from September 20 at 19:03 UTC, named mvp-restore-rehearsal-20260920 (br-rough-feather-awixlduh). Read-only SQL verified 7 applied migrations, restored application tables, 2 users, 5 images, 2 garments and zero orphan garment relationships. Production was not reset. Temporary branch automatically expires at 20:14:28 UTC. This proves point-in-time data recovery and connectivity; no application cutover was performed. Six-hour retention cannot recover older incidents; longer retention requires a separate provider plan decision.

Vercel AI Gateway project budget for digital-wardrobe-app: $1 daily, 75% and 100% email thresholds enabled for the existing team usage-alert recipients. Saved daily limit verified in the dashboard. Actual email delivery is not tested. No team-wide budget changed and no credits purchased. App ledger retains its existing daily/request/user controls.

Production runtime error-log query over the preceding 24 hours returned no entries. New cron service alerts check repeated AI failures and 80% application budget use, with once-per-day deduplication and retry after delivery failure. OPS_ALERT_WEBHOOK remains unset because no destination was supplied. This is not a general uptime monitor.

## Owner-dependent launch gates

1. Provide the support forwarding recipient and configure domain mail routing. MX lookup found no MX records; support@fitstalker.com delivery is not verified.
2. Provide the service-alert webhook destination; send and acknowledge a test notification. Confirm receipt of provider usage alerts with the team recipients.
3. Sign into FitStalker with the designated Google owner and open /admin. Backend tests reject unverified/non-Google administrator access; actual owner sign-in remains a manual check.
4. Physical iPhone and Android: photo upload, installation, native sharing, keyboard behavior, both themes and updating with unsaved work. Drafts require Save draft layout before reload.

## Deployment and rollback

Deploy the validated commit, then explicitly assign fitstalker.com, www.fitstalker.com and digital-wardrobe-app-vert.vercel.app. These aliases have previously remained pinned to old releases. Verify /api/health on all three and inspect the public entry UI.

Immediate rollback target: digital-wardrobe-hi8s4oymb-almonjs-projects.vercel.app (ca47e0a). The new database tables are additive and can remain during code rollback. Do not delete them during rollback. If data restoration becomes necessary, first create an isolated historical branch, validate relationships and migrations, and arrange a controlled maintenance/cutover plan; never reset main merely to test recovery.

Subscriptions, extra agent personas, gamification, guaranteed exact matches and customer-facing cutouts remain outside this MVP.

Final regression: 44 passed, 9 opt-in tests skipped; shirt and layered-group live evaluations passed separately. No failing automated checks remain.

