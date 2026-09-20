# Real-photo evaluation

These opt-in cases evaluate specific behaviors, not population accuracy. Keep photos outside the app/repository; never seed customer closets with evaluation data. Tests use temporary accounts and delete their uploads and records afterward. Each run has no automatic provider retries and goes through the application budget ledger.

## Layered group v1

Source: [Priscilla Du Preez, Unsplash, April 6, 2017](https://unsplash.com/photos/womens-white-shirt-and-blue-denim-jeans-tAZQSCz5rN8), offered under the Unsplash License. Image: `https://images.unsplash.com/photo-1491438685042-6e6d559f350a?auto=format&fit=max&fm=jpg&q=80&w=1000`.

Manual inspection before testing: three people; a blue denim jacket over a white layered sleeveless blouse and long dark skirt on the left; dark jacket and blue jeans in the middle; dark top/trousers and black hat on the right. Parts are hidden or overlap. No readable brand label. The agent is limited to six visible pieces, so this case cannot require a complete inventory of every person's clothes.

Expected: detect at least outerwear, a top, and bottoms; do not invent branding. With a sparse closet, choose the blue denim jacket and white layered blouse as owned substitutes, leave missing pieces unmatched, and never select unrelated red formal gown or yellow rain boots. With no closet, retain visible elements but return no garment IDs. Repeated identical requests reuse the result.

Run from the repository using PowerShell:

```powershell
$env:LIVE_OUTFIT_PHOTO = (Resolve-Path '../evaluation-outfit.jpg').Path
node node_modules/@playwright/test/cli.js test tests/browser/outfit-evaluation.spec.ts
```

At most three paid actions: one capture and two Spotter runs. Build the app first. Playwright saves a JSON attachment with outputs and end-to-end elapsed times. Test accounts are deleted; these timings include network and database overhead. Dollar costs must come from the ledger/provider rather than timing estimates.

## Coverage still required

Single-person full-body outfits, similar competing owned pieces, readable and unreadable labels, dark/low-light clothes, unusual fabrics, and actual user phone uploads. Group-photo success does not establish which person's outfit a user intended; there is currently no person-selection control. Shopping delivery eligibility and exact identity remain separate acceptance checks.

## September 12, 2026 result

Initial run detected six pieces and chose both appropriate owned substitutes without unrelated IDs, but failed the empty-closet check: the matcher returned no elements despite visible clothing. Capture also claimed every item had been found despite its six-piece ceiling. Fixed by routing zero-candidate matching through one Capture call and mapping every detected element to a missing garment; no additional paid call. Capture summaries now use controlled coverage wording, including on historical scan retrieval. Cache versions advanced for changed behavior.

Post-fix run passed all case assertions. Capture: 3,824 ms; sparse matching: 4,466 ms; empty closet: 4,381 ms. Detected six pieces, no brands; selected the denim jacket and white blouse, rejected red gown and yellow boots, and left other pieces unmatched. Empty closet returned six elements with null garment IDs. Cache reuse and cleanup passed. Seven targeted tests passed overall; two unrelated live evaluations were intentionally skipped. This is one successful run of a specific case, not a statistical accuracy estimate. No photos or customer data were committed.
## September 20, 2026 MVP result

Both the shirt discovery-to-save case and the layered group case passed with the current implementation after refreshing local Gateway authentication. The shirt produced three source-backed similar alternatives and persisted across reload/cache reuse. All three stock statuses remained unknown, and some retailer paths used non-US locales despite a US search. Treat results as candidates, not verified delivery eligibility or a merchant endorsement.

The group case identified six pieces without readable-brand claims, matched the denim jacket and white blouse, rejected unrelated owned candidates, and returned no owned IDs for an empty closet. Measured capture: 6,299 ms and $0.001866; sparse matching: 5,151 ms and $0.001874; empty closet: 5,856 ms and $0.001861. Total $0.005601 from settled request receipts. Shirt end-to-end browser flow: 19.1 seconds; per-action costs were not captured in that run's report. No made-up per-search cost estimate is substituted.

These examples do not cover phone camera behavior, population accuracy, every garment, or regional merchant eligibility. See MVP_RELEASE_VERIFICATION.md for release and operations evidence.
