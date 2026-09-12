# Internal garment cutout evaluation

Owner decision, September 12, 2026: do not expose cutouts in the app. No customer controls, API route, automatic processing or deployment added. Candidate implementation lives under tests/support, outside production source. Original photographs remain unchanged.

## Provider review

- Gemini through the existing paid Gateway: [Google documents contour segmentation](https://ai.google.dev/gemini-api/docs/image-understanding#segmentation). Gateway model catalog checked September 12: google/gemini-3.8-flash, $0.75/million input tokens and $3.75/million output tokens at listed base rates. Output capped at 4,096 tokens; existing application ledger reserves $0.10/action and retains unknown charges. No additional service account needed.
- [fal SAM 3](https://fal.ai/models/fal-ai/sam-3/image) advertises text/point/box segmentation, commercial use and $0.005/request. Not provisioned or tested; image handling/retention and account configuration require evaluation before any customer use. Advertised price is not a quality measurement.
- [remove.bg](https://www.remove.bg/a/api-docs) offers background removal; that alone does not demonstrate isolation of a selected garment from a person wearing several items.

Privacy: [Vercel provides ZDR and no-training controls](https://vercel.com/changelog/zero-data-retention-no-prompt-training-on-ai-gateway). Team enforcement was not verified in this batch, so no zero-retention promise is made. Only the previously sourced public evaluation photo was submitted. No new third-party accounts or purchases.

## Implementation and result

The candidate accepts bounded, validated numeric contour rings, applies an even-odd mask to original pixels, and emits transparent PNG. It rejects absent, degenerate, oversized or out-of-range masks. The deterministic test passes for preserved RGB/alpha, interior holes, background transparency and invalid geometry. This verifies rendering, not segmentation quality.

Two explicit live attempts failed before producing a usable mask: documented minimal thinking was rejected by the routed model; low thinking then returned an invalid-argument error. Exact cause of the second failure is unresolved. No visual quality acceptance was possible. Unknown spend reservations remain held rather than being falsely refunded. Temporary evaluation users were deleted. No automatic retries.

Decision: keep the candidate internal and stop further paid attempts for now. The test remains opt-in via LIVE_CUTOUT_PHOTO and LIVE_CUTOUT_DESCRIPTION. Do not treat its successful renderer test as provider acceptance. Before revisiting: resolve provider compatibility, evaluate clothing edges/overlap/transparency, and verify retention and cost. Customer preview/accept/reject and persistence are not implemented.
