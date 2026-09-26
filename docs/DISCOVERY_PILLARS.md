# FitStalker discovery priorities

The product promise is: discover a fit worth wearing, then find the actual pieces.
Keep the interface simple: found links, useful alternatives, or edit search.

## Implemented in this change

- Capture requests garment bounds; retailer comparison receives the selected garment crop plus the full reference. Keeping full-image context is necessary because live scans show imperfect predicted boxes. Older scans use the full reference alone.
- Editing the search clears crop/brand/code assumptions.
- Product pages without usable JSON-LD photos can supply an unambiguous OpenGraph photo. This does not provide stock, price, brand or product identity. Existing URL, DNS, redirect and image checks still apply.
- Cache versions changed so new scans/searches use the new pipeline.
- Search retains up to 12 sources and ranks up to 8 candidates before validation, then returns at most 5 links. This leaves backups when retailer redirects or visual conflicts remove leading candidates. The existing single search call, three-photo comparison and request spending limits remain.
- A tested rising-fit scorer requires timestamped observations, compatible counter definitions, fresh measurements, a same-platform/cohort baseline, garment relevance, and creator/content diversity. It rejects resets and insufficient evidence.

The scorer is a foundation, not a connected social feed. No social provider is configured and the current For You feed remains editorial. Its thresholds are initial heuristics, not a validated definition of virality. Garment bounds are model predictions; fixture tests do not establish real-world detection accuracy.

## Next implementation order

1. **Visual retrieval:** trial a service that searches the garment image itself, then merge/deduplicate its product candidates with current text search. Keep user uploads private. Google Vision Web Detection accepts image bytes; evaluate its actual retail coverage before selecting it. Do not make private uploads public merely to satisfy a provider URL requirement.
2. **Product identity index:** ingest permitted retailer catalog feeds with canonical product IDs, brand/model/variant, product photos, region and observation time. Retrieval finds candidates; identity verification distinguishes the same product from a similar silhouette. The current strict code-and-photo gate remains until a separately evaluated identity path exists.
3. **Social observations:** select an authorized source, persist immutable snapshots, and run bounded scheduled ingestion. Preserve source URLs and attribution. Store counter version, market/format/age cohort and duplicate cluster. Connect the scorer only after real data validates its assumptions. Never mix editorial freshness with social growth or compare raw TikTok views directly with YouTube views.
4. **Discovery loop:** show fresh, relevant rising fits with varied creators; let users scan individual pieces. Keep source/fit/product relationships so successful item matches improve the discovery experience.
5. **Learning loop:** collect optional confirmed/rejected item matches and saves/hides with provenance. Review labels, version changes, and run held-out evaluations before promotion. Do not use model guesses as ground truth or silently train on private screenshots.

## Evaluation before claiming superiority

Build a permissioned, human-reviewed benchmark of at least 100 queries: known exact products, near-identical alternatives, hard negatives, unavailable items, multi-person screenshots, and all supported shopping regions. Split by product and creator, so held-out cases are not duplicates of development examples. Record catalog truth and verification date; an AI-generated editorial image is not an exact-item ground-truth case.

Report separately:

- Exact top-1 precision, coverage and number of false exact claims.
- Exact recall at 5 for items known to be available in the indexed catalog.
- Useful alternative rate, empty-result rate and region correctness.
- Per-stage failures, retail-photo comparison coverage, median/p95 latency and cost.
- Social freshness, outfit relevance, duplicate rate, creator diversity and saves per impression.

Initial release targets, not achieved results: zero false exact claims in the reviewed release set, at least 90% exact-label precision on a sufficiently sized held-out sample, and no regression in useful alternatives. Report sample size and uncertainty; a small perfect score is not proof. Tune rising thresholds with real snapshots and reviewed examples before adding a public viral label.

Compare the same queries, regions and dates against a baseline and competing workflows. Keep examples and failure reasons. The durable product advantage should come from a permissioned fit-to-product dataset, fresh source coverage and verified outcomes; adding agent names does not establish that advantage.

## External access still needed

No new subscription is purchased by this change. Social and visual-retrieval provider credentials, permitted-use terms and a monthly spend ceiling must be settled before connecting paid ingestion. TikTok Research API access is not a commercial-product data shortcut.

Primary references:
- https://docs.cloud.google.com/vision/docs/detecting-web
- https://serpapi.com/google-lens-api
- https://developers.google.com/youtube/v3/docs/videos/list
- https://developers.tiktok.com/docs/en/research-api-faq
