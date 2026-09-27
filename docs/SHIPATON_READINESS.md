# FitStalker submission readiness

Reviewed September 27, 2026 (New York). Event identity and entrant/store status still need confirmation. This is an evidence register, not a certification. Customer billing remains off; neither purchases nor advertisements are authorized by this document.

## Eligibility first

If the intended event is RevenueCat Shipaton 2026, standard entries require a published supported app-store app and RevenueCat purchase or Ads integration by September 30, 11:45pm PDT. A pending store review is insufficient. A previously web-only product may qualify through its first store release during the submission window. Next Gen has a separate student/open-source route; eligibility is unconfirmed. See the [official rules](https://revenuecat-shipaton-2026.devpost.com/rules).

This checkout is a Next.js web/PWA product, with no native store project or RevenueCat integration found. Production reports billing off. An external store release may exist, but none has been supplied. A web deployment does not close these gaps.

RevenueCat's current [submission guide](https://www.revenuecat.com/blog/engineering/how-to-submit-your-app-for-shipaton) confirms that TestFlight/testing tracks and pending review do not qualify for standard entries. RevenueCat Ads is an alternative to purchases, but it is a separate product/privacy decision, not an automatic workaround for billing staying off. The deadline above is October 1 at 2:45am in New York. Until the owner confirms the event/category, prepare reusable demo evidence without claiming eligibility or promising approval before that deadline.

## Apple Store and PWA: concrete next gates

| Gate                          | Verified state                                                                                                    | Next deliverable                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distribution access           | This workspace is Windows; no iOS project, signed build or supplied store listing found                           | Confirm Apple Developer membership, App Store Connect role, bundle ID and access to a Mac or hosted macOS build environment; do not purchase enrollment automatically              |
| iOS application               | Current release is a Next.js PWA                                                                                  | Choose a real iOS implementation; prototype photo selection, screenshot handoff and saved-outfit interaction against existing private APIs before expanding scope                  |
| Authentication                | Google and password login exist; no Apple login implementation found                                              | Review the proposed iOS login against guideline 4.8; implement Sign in with Apple or demonstrate an applicable compliant alternative/exemption before submission                   |
| Privacy and account lifecycle | Private image handling and account-deletion endpoint exist                                                        | Verify deletion inside the iOS UI; review explicit third-party AI permission, native permissions, SDK privacy manifests, data disclosures and actual support delivery              |
| Build and review              | No store build evidence                                                                                           | Create signed build, test through TestFlight, prepare accurate screenshots, privacy/age-rating/export-compliance answers and reviewer access; keep reviewer credentials out of Git |
| PWA acceptance                | Manifest, install affordance, share target and public-only offline cache exist; earlier browser checks documented | Record physical iPhone Safari installation/upload and Android installation/share tests, weak-network recovery and a deployed worker update with unsaved work                       |

Apple expects more than a repackaged website (4.2), an equivalent privacy-preserving login option when covered social login is used (4.8), in-app account deletion where accounts are created, explicit permission before third-party AI sharing, and complete reviewer access. These are review gates, not claims that this web app already satisfies native review. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

Current upload requirements specify Xcode 26 or later with the iOS 26 SDK or later; the deployment target must be iOS 13 or later. Check again before archiving. [Apple requirements](https://developer.apple.com/news/upcoming-requirements/) Submission requires metadata, a selected build and an Account Holder, Admin or App Manager role. [Submission steps](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app)

Recommended native demo slice: import screenshot, select one garment, inspect real visual shopping results, save an owned piece, and build/reopen its outfit. Native photo handling and sharing are proposed implementation work, not currently shipped capabilities. Preserve explicit AI actions and existing account boundaries. PWA readiness remains independently useful and does not substitute for a store release.

## What is demonstrated

| Area              | Evidence                                                                                                        | Remaining gap                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Shopping          | Live screenshot detection, candidate retrieval, visual review and private product-photo endpoint                | Reliable direct-retailer recall and country availability                    |
| Photo handling    | Regression checks retain same-product photos with tracking links or expired offers, reject conflicting variants | Retailers without accessible photos still require better source coverage    |
| Discovery UX      | Earlier production checks covered distinct audience filters, refresh, saves and removal of blank cards          | Fresh social observations are not connected                                 |
| Agent constraints | Historical metadata release passed 25 local quality/security-contract checks                                    | Historical count is not the current total or a population accuracy measure  |
| Data access       | Owner-scoped photo route, deletion checks and historical isolated SQL restore                                   | Physical-device, current-schema app recovery and alert delivery remain open |
| Submission        | Pitch, demo sequence and completion checklist drafted                                                           | Store route, monetization, actual recording, assets and final submission    |

## Live evaluation: September 27, 02:20 UTC

One attempt per case against production before this metadata fix. No ground-truth URL, product name or SKU was sent to the agent; only neutral-named image bytes. Existing allowance was respected. Temporary QA account was deleted.

- Official white Adidas Samba photo: detected a shoe and Adidas; no readable model code. Returned one visually consistent alternative with a working product photo in approximately 16 seconds.
- The returned [Sneakerjagers page](https://www.sneakerjagers.com/en/s/adidas-samba-og-white-b75806/62886) identifies B75806, the reference model. This is a manual follow-up observation, not an automated exact-label pass. Its displayed offers were in GBP/EUR, so US purchase availability was not established.
- The preregistered official Adidas URL was absent: **expected-URL retrieval failed**. Do not replace the target after seeing results or interpret this as failure to identify the model at all.
- Blank image: zero detected items, approximately 1.9 seconds: **passed**.
- Zero verified-exact labels. One decoded photo out of one returned listing. Sample size is two inputs, only one product: no general accuracy estimate.

The original machine report is kept in the workspace at `outputs/shipaton-baseline.json`; reference imagery is not committed or licensed for a public demo.

## Execute next

1. Confirm event URL/category and Apple developer/build access. Resolve the eligibility conflict with billing off before selecting an event-specific implementation. Store review timing is outside our control.
2. Confirm a qualifying store/platform route compatible with the owner's billing-off decision. Any purchase or entitlement implementation requires a changed product decision; it is not authorized by this checklist. Do not invent IDs or treat a web wrapper alone as a successful store release.
3. Improve retrieval with an authorized image-search/catalog source. Benchmark representative screenshots, lookalikes and supported countries. Require image-first results and usable local purchase links; distinguish identified product, verified exact label and purchase availability.
4. Connect permitted, timestamped social observations before claiming live viral discovery. Current editorial feed and tested scorer are separate. Do not buy a provider subscription without an agreed spend ceiling.
5. Run the complete demo on the intended physical device: sign up, upload, select garment, shop, save, build from closet, refresh, sign out/in, delete account. Check poor connectivity, denied photo permission and provider failure. Retest after fixes.
6. Verify production monitoring and support delivery. Repeat the successful September 20 isolated SQL restore against the current nine-migration schema and exercise application flows; the earlier seven-migration drill did not prove app cutover. Recheck the recorded six-hour history window. Capture real store/device evidence, then complete the submission checklist. Do not label the app certified.

## Repeatable matching evaluation

Use `scripts/evaluate-shopping.mjs` with Node and installed dependencies:

```powershell
$env:LIVE_SHOPPING_EVAL='true'
$env:TEST_BASE_URL='https://fitstalker.com'
node scripts/evaluate-shopping.mjs path/to/manifest.json path/to/report.json
```

The report directory must exist. The runner accepts one to four local fixtures, respects the existing allowance, never retries a failed case, probes returned photos, and deletes its account. Failed URL retrieval produces a nonzero exit. Account cleanup failure also fails the run.

```json
{
  "cases": [
    {
      "id": "known-product-01",
      "kind": "product",
      "file": "permissioned-reference.jpg",
      "country": "US",
      "category": "shoes",
      "expectedUrls": ["https://retailer.example/products/known-item"],
      "source": "https://retailer.example/products/known-item"
    },
    { "id": "negative-01", "kind": "no-clothing", "file": "blank.png" }
  ]
}
```

Expected URLs must be established before running. Manually review unlisted retailers separately. Keep exact-label precision, expected-URL recall, image coverage, regional purchasing and latency separate. Grow a permissioned, held-out set before claiming superiority; see `DISCOVERY_PILLARS.md`.

The optional standalone visual-retrieval pilot and offline report comparison are now prepared; no live provider improvement is established by their offline tests. Follow `IMAGE_RETRIEVAL_PILOT.md` for permissioned fixtures, server-only credentials, per-run limits and manual allowance checks. Use `scripts/compare-retrieval-reports.mjs` only with matching raw fixture hashes, countries and frozen targets; historical normalized-only hashes cannot establish a comparable baseline. Do not enable customer retrieval or weaken exact-label verification to complete a demo.
