# FitStalker submission readiness

Reviewed September 26, 2026 (New York). Event identity and entrant/store status still need confirmation. This is an evidence register, not a certification.

## Eligibility first

If the intended event is RevenueCat Shipaton 2026, standard entries require a published supported app-store app and RevenueCat purchase or Ads integration by September 30, 11:45pm PDT. A pending store review is insufficient. A previously web-only product may qualify through its first store release during the submission window. Next Gen has a separate student/open-source route; eligibility is unconfirmed. See the [official rules](https://revenuecat-shipaton-2026.devpost.com/rules).

This checkout is a Next.js web/PWA product, with no native store project or RevenueCat integration found. Production reports billing off. An external store release may exist, but none has been supplied. A web deployment does not close these gaps.

## What is demonstrated

| Area              | Evidence                                                                                                        | Remaining gap                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Shopping          | Live screenshot detection, candidate retrieval, visual review and private product-photo endpoint                | Reliable direct-retailer recall and country availability                    |
| Photo handling    | Regression checks retain same-product photos with tracking links or expired offers, reject conflicting variants | Retailers without accessible photos still require better source coverage    |
| Discovery UX      | Earlier production checks covered distinct audience filters, refresh, saves and removal of blank cards          | Fresh social observations are not connected                                 |
| Agent constraints | 25 local quality/security-contract checks pass in this change                                                   | These do not measure population accuracy or replace a security audit        |
| Data access       | Owner-scoped photo route and existing account deletion checks                                                   | Physical-device, recovery and operational incident drills remain unverified |
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

1. Confirm event and existing store-account/release status. If this is the standard RevenueCat entry, prioritize a qualifying store release and RevenueCat entitlement flow over adding agents. Store review timing is outside our control.
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
