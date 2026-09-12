# Clothing discovery — September 12, 2026

Implemented on `codex/production-wardrobe`; not validated for customer launch.

## Included

- Explicit photo-analysis action in Spotter, structured clothing detection, and editable details before saving to the real closet.
- Server-side Gemini vision through Vercel AI Gateway OIDC; no Gemini key in the browser or repository.
- Perplexity search followed by structured selection of retailer product sources. URLs come from search output, not model-generated links. Similar alternatives and possible exact matches are labeled; price and stock are not invented.
- Region selection, recent scan history, preserved scan photos, per-user authorization, bounded input/output, daily ledger reservation, no automatic SDK retries, and same-day result reuse.
- Unknown charges retain their budget reservation. Interrupted requests are not automatically replayed. Same-day retries of interrupted actions are deliberately blocked; completed results remain reusable.

## Verification

Production build and TypeScript passed. Nine non-live tests passed across the full suite and the corrected targeted UI run. These cover existing accounts/creator flows, ledger concurrency, unsafe and unknown shopping sources, mobile discovery UI, real upload/save, and server request validation.

Discovery UI tests substitute provider responses only inside Playwright; there are no fixture results or mock fallbacks in the application. One opt-in live end-to-end test was attempted and remains failing at the provider boundary. The default suite skips it unless `LIVE_DISCOVERY_PHOTO` is set. It expects the blue shirt photo used for evaluation, so supply the same fixture when re-running it.

The Vercel account initially showed $5 credits and zero usage. Gemini 3.8 Flash and 3.1 Flash Lite returned restricted-model HTTP 403. Gemini 2.5 Flash answered a tiny text probe, but real image calls repeatedly returned free-tier HTTP 429; Flash Lite image probing was also rate-limited. Total Gateway usage after investigation was $0.0013096. No credits were purchased.

Local testing uses a $1 daily reservation budget and $0.10 reserved per action. Production/preview AI enablement has not been changed. Provider limits and actual charges remain additional constraints; the ledger is not a guarantee that external pricing cannot change.

## Next release gate

1. Restore usable Gateway provider capacity (paid credits are the direct path), without adding a Gemini key to client code.
2. Run the live photo → detection → retailer links → saved closet test; inspect actual listings and a second contrasting garment/no-clothing photo.
3. Evaluate image detection quality and source relevance; address any output, search-tool, latency or cost issues revealed by real calls.
4. Configure the approved preview budget, deploy a protected preview, and verify hosted behavior before enabling customer access.

Monthly Top 10 clothing trends is recorded in `AGENT_PRODUCT_SPEC.md` as the next product addition. It is not implemented in this batch.
