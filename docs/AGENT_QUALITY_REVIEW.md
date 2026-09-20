# FitStalker shopping and agent quality review

Date: September 20, 2026

## Changes

Shopping now excludes explicit conflicting country storefronts before ranking and after retailer redirects. US, UK, Canada and Australia use named regional search instructions. Unknown storefronts remain unverified, not proof of delivery. Product-type conflicts, excluded page types and known over-budget offers in the selected currency are removed. Unknown URL structures require product metadata. Tracking URL duplicates are removed while variant identifiers are preserved. Out-of-stock offers rank last. Unknown prices and different currencies are not represented as budget-verified.

The ranking instructions prioritize garment type, color and cut, allow no results when evidence is insufficient, and require supported explanations. Possible-exact labels additionally require a readable detected brand token in the source title; they still do not establish exact identity. Explanations truncate at word boundaries. Saved shopping history is rechecked without another AI call. New searches use a versioned cache identity.

Spotter clears unsupported, repeated or clearly wrong-category owned matches. Stylist preserves the user's locks, removes unowned IDs and incompatible unlocked category combinations, and labels missing clothing or footwear. Explicit locks remain authoritative even when they conflict. These checks do not prove aesthetic quality.

All five agents persist generation receipts before structured-output validation. Known single-stage failed output can settle its measured cost instead of retaining the entire reservation. Unknown costs and partial shopping executions remain held. Existing model, retry limits and spending caps are unchanged. Cost lookup has a three-second wait bound; missing costs remain unknown.

## Validation

Production build and formatting passed. Initial full run: 57 passed, 5 skipped, 2 test failures. The new ledger fixture used a request key shorter than the contract minimum; corrected. The opt-in Stylist test assumed the old default tab and timed out before generation; corrected to navigate to Closet. Both affected checks then passed in a targeted run (12 passed, with a separate new exact-item evaluation failing as described below).

The real shirt flow passed in 19.8 seconds: capture, four sourced alternatives, save to closet and cached repeat. Returned sources were US storefronts or generic domains without a conflicting locale. Two retailer offers were out of stock and ranked last; other availability was unknown. One product appeared under distinct variant/page URLs, which are intentionally not collapsed solely by title. This is one shopping case, not a broad quality benchmark.

New deterministic tests cover regional storefront paths/domains, redirects, currency-aware budgets, page eligibility, product types, canonical URL deduplication, supported branding, old-result review, owned matches, locked outfits and measured failure accounting. Four country cases contain 40 locale comparisons; these are not 40 real-photo evaluations.

Layered group evaluation passed: six visible items, no guessed brands, two appropriate owned matches and no irrelevant gown/rain boots. An empty closet returned no invented IDs. Capture cost $0.001899, sparse matching $0.001511, empty-closet processing $0.001856; total $0.005266. Creator and Stylist live flows also passed.

## Known-product learning case

Ground truth: Adidas Samba OG, Cloud White / Core Black / gum, product code B75806, https://www.adidas.com/us/samba-og-shoes/B75806.html. Official product-only image: https://assets.adidas.com/images/w_500%2Cf_auto%2Cq_auto/3bbecbdf584e40398446a8bf0117cf62_9366/Samba_OG_Shoes_White_B75806_01_00_standard.jpg. Re-encoded to JPEG with metadata stripped, uploaded as input.jpg. SHA-256: 342084772edd6b695f422c9f68589b7d789572afb500b51111f4bc93b37a0c9b. Only image bytes and region enter the app; the evaluator withholds expected SKU and source URL.

Initial attempt failed: Capture named it Adidas Samba Classic, described the white/black/grey/gum features, and shopping returned no qualified offers in 9.25 seconds. This is a failed retrieval, not a verified exact match. Inspection identified a filter weakness: official Adidas SKU-based HTML URLs were treated as unknown and required metadata that may be unavailable. Added a narrow retailer URL-format rule, tested with two distinct model codes plus category and unrelated-host negatives. This admits direct product-shaped URLs without claiming verified stock or exact identity. Across five evaluation attempts: three completed searches returned no offers, one shopping execution returned a service error, and the fifth passed after the URL-format fix and a general Capture instruction against guessing model variants. The successful run used the same image hash, took 9.286 seconds for capture/search, and ranked the exact official B75806 page first. Samba XLG IE1377 was second and labeled similar. Capture stopped adding the unsupported Classic variant. Search diagnostics confirmed the independent query contained visible brand/model text and visual features, not the hidden SKU. Availability remained unknown. Generation variability means the changed result alone cannot isolate causality; this is not a five-out-of-five success claim. Temporary diagnostic logging was removed.

The test is tests/browser/exact-item.spec.ts, enabled with LIVE_EXACT_ITEM_PHOTO pointing to the documented local image. It requires the official US URL containing B75806. Other Samba variants do not count. This is a clear catalog-photo baseline, not proof of Instagram screenshot performance or model training.

## Limits and follow-up

Retailer authenticity, size stock, delivery eligibility and exact visual identity still require retailer confirmation. Domain/path locale checks cannot establish all shipping policies. Metadata may be blocked or absent. Relevance is model-assisted and needs a representative human-reviewed photo set before an accuracy claim. Physical-device Instagram screenshot/upload testing remains separate from simulated mobile-browser coverage. No automatic screenshot capture from Instagram was added.

Final code build and formatting passed. After removing diagnostic logging, targeted tests passed 22 checks; one optional jacket evaluation was skipped. A repeated live shirt test was blocked at test-account signup by the existing 30-per-15-minute IP limit (HTTP 429), before any AI call. The earlier shirt flow passed; the final Capture wording is verified by the successful known-product test. Rate limits were not weakened.

## Release

Published runtime 29fec37 to digital-wardrobe-7yvfx6c4k-almonjs-projects.vercel.app (dpl_7CcmNMb6mCsA15FxY4MfB34f4LJg). All three production domains returned healthy database status and version 29fec37. Automatic domain assignment is enabled; the project production target and hourly minute-17 cron both point to this deployment. Rollback target: digital-wardrobe-691xzav2i-almonjs-projects.vercel.app (runtime 883aff0). No schema migration is required for this change.
