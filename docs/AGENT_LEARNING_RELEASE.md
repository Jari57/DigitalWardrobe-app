# FitStalker: visual evidence and private agent learning

September 20, 2026

## What now improves with use

Each agent offers structured feedback with an explicit remember checkbox. Remembered reasons are private to that account and are incorporated into the next explicit generation. Capture focuses on corrected recognition weaknesses; Shopping focuses on color, silhouette, identity or retailer concerns; Spotter focuses on pairing quality; Stylist incorporates formality preferences and avoids rejected outfit combinations; Creator incorporates brevity, tone and unsupported-detail feedback. The newest conflicting formality preference takes precedence. Current requests and locked garments remain authoritative.

Memory is derived from at most the last 50 rated suggestions per agent, with at most six rules, six rejected combinations and three helpful combinations in prompts. Old ratings without an explicit remember flag do not become training consent. Account settings shows the rules and saved-piece combinations, and supports per-agent or full reset. Reset removes learned preference details without deleting saved content or ratings. Account deletion cascades through the underlying records. Memory versions form part of request cache identities; feedback itself does not invoke a provider or spend AI allowance.

This is feedback-driven personalization, not model-weight training, autonomous code editing, shared-user preference aggregation or an automatic paid evaluation schedule. Continued improvement depends on explicit user feedback and evaluated software/model changes.

## Agent changes

Capture adds literal readable image text and an optional observed model/style code. A code unsupported by the captured readable text is discarded. User-edited shopping descriptions clear brand/code evidence, preventing a correction from establishing identity. Old saved scans remain readable.

Shopping extracts product image, brand, model code and color metadata only from a product associated with the returned page. It can compare up to three safely fetched retailer images to the original screenshot in one additional bounded AI stage. DNS is pinned to validated public IPv4 addresses; every redirect is revalidated, and image size, media type, decode size and duration are bounded. Missing/blocked photos are explicitly marked not reviewed and trigger no visual-provider call. Visually different candidates are removed; uncertain or alternative candidates cannot be promoted by this stage. Model-code agreement requires matching observed/retailer codes, matching brands and visually consistent details. This evidence still does not guarantee authenticity, stock or an exact variant.

Spotter compares up to 12 owner-scoped garment images alongside its existing bounded candidate descriptions. It reports partial coverage and must not claim to inspect missing or ambiguous images. No cross-account photos are accepted. Stylist keeps its description-based workflow, now with personal preference memory and deterministic rejection of disliked full combinations unless the user locks them together. Creator grounds drafts in saved names and brands; common unsupported brand/material, URL and promotional claims are replaced by a neutral draft with an explanation. This is bounded heuristic validation, not complete natural-language fact verification.

The existing model, daily spending cap, per-request reservation and zero automatic retry policy remain. Visual shopping can have three metered stages; recovery requires all three receipts before releasing the unused reservation. Unknown or partial costs remain held. No extra subscription, fine-tuning job or provider credit purchase was introduced.

## Verification

- Additive migration 202609200002_agent_learning applied; eight migrations total.
- Build/type checks passed. Full regression: 63 passed, 10 opt-in tests skipped.
- Follow-up live and targeted checks: 17 passed, one optional jacket case skipped. Creator, Stylist, shirt shopping, known-product retrieval and layered-group/closet flows passed.
- Shirt flow returned five sourced alternatives in 20.9 seconds. Retailer metadata did not supply usable product images in this run; all candidates correctly reported no photo comparison. Do not count this as a live visual-ranking success.
- The image-only known-product test retrieved official Adidas B75806 first again in 9.121 seconds. Capture returned generic shoe attributes, readable SAMBA text and a null model code, avoiding the previous guessed Classic variant. Two other Samba variants remained possible/similar alternatives; no runtime verified-exact claim. Retailer photos were unavailable in that search.
- Group evaluation: Capture $0.002108, owned match $0.001681, empty closet $0.002254; total $0.006043. Spotter explicitly identified the test fixture limitation that candidate photos reused the inspiration photo. This validates multimodal transport and honest limitation reporting, not independent closet-photo accuracy.
- Controlled visual comparison passed: original white shoe retained as visually consistent; opposite black colorway removed; identity remained unverified. One provider stage, 2.303 seconds, $0.000522 measured cost. This isolates the photo-comparison stage using documented product-image fixtures, not a claim that blocked retailer metadata is available.
- Enhanced cross-account/reset/feedback UI suite: 8 passed after adding an explicit accessible label to the reason selector. Another authenticated account cannot read, change or clear the owner memory. A saved UI correction changes the private rule without creating any generation receipt. Mobile feedback and memory screens were inspected.
- Final build, formatting and diff checks passed. There is no broad Instagram-photo accuracy benchmark yet.

## Release and rollback

Published runtime b8cb76d to digital-wardrobe-590vei67v-almonjs-projects.vercel.app (dpl_BiQEahyWir37Wn5PfTdEhCTvWktU). fitstalker.com, www.fitstalker.com and digital-wardrobe-app-vert.vercel.app each returned HTTP 200 with a ready database and version b8cb76d. The project production target and hourly minute-17 cron point to that deployment. Guest GET /api/agent-memory returned 401. The live privacy page contains the new memory and visual-comparison disclosures. Rollback runtime: 29fec37, deployment digital-wardrobe-7yvfx6c4k-almonjs-projects.vercel.app. The new nullable feedbackDetails column is additive and may remain during rollback. Verify all production aliases, project production target and the hourly minute-17 feed cron after publication.


Production UI limitation: the browser-control tool could not start its app-server (missing path), so no final authenticated inspection of the owner browser was performed. Local mobile browser interaction, feedback save/reset, cross-account isolation and screenshots passed; production verification used deployment metadata and HTTP responses.
