# FitStalker launch review — September 13, 2026

Decision: proceed with a controlled real-world beta after deployment verification. Do not describe the app as certified, bug-free, or proven at viral scale. Stripe remains excluded.

## Changes from the team review

- Navigation follows the core journey: Spotter, For You, Closet, Canvas, Looks, Stats. Spotter remains the default.
- Fixed a privacy defect: signing out while on Spotter could leave previous scan descriptions/history visible. Successful sign-out and account deletion now remount the entire Spotter subtree. A guest screenshot still survives signing in. Added a fixture-only regression with no provider calls.

## Independent reviews

- Product reviewer inspected screenshot discovery, shopping, onboarding and remaining acceptance gates; identified the sign-out issue above.
- Security reviewer inspected authentication/admin, owner-scoped data, normalized/private uploads, AI reservations/limits and retailer fetch protections. No additional concrete high/medium defect was identified in the bounded review. This is not a penetration-test certification.
- Primary reviewer checked navigation, integrated the fix, and ran release checks.

Validation: production build and formatting passed. The default suite produced 33 passes, 9 opt-in live checks skipped, and one stale navigation assumption in the allowance test. Updated that test to open Closet explicitly; its targeted rerun passed. Final coverage: 34 passing default checks, 9 skipped live checks. No paid AI evaluation was run. Mobile screenshot inspection confirms the reordered navigation and primary upload CTA.

## Before broad public promotion

- [ ] Owner completes Google login and checks administrator access on fitstalker.com. Configuration is verified; a completed owner OAuth round trip is not.
- [ ] Physical iPhone and Android checks: screenshot picker, installed PWA, OS share sheet, keyboard, light/dark mode and update with unsaved work.
- [ ] Confirm database backup retention and complete an isolated restore rehearsal.
- [ ] Confirm provider-side spending alerts. Application spending safeguards are implemented and covered by tests.
- [ ] Broaden live multi-piece recognition and retailer/variant coverage. Existing live cases are limited; this review does not spend on additional AI evaluations.

## Operating limitations

For You currently offers personalized editorial discoveries, not verified TikTok momentum. Public production inspection returned 19 items with a successful refresh timestamp and partial source unavailability; the UI discloses unavailable sources. Exact clothing identity, size availability and shipping eligibility are not universally established. Unknown retailer data stays unknown. Cutouts remain internal by owner direction.

See FITSTALKER_BRAND.md for domain/branding configuration and older evaluation documents for historical provider evidence. This review supersedes historical claims that branding/domain selection is deferred.
