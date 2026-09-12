# Digital Wardrobe agents — launch specification v1

## Objective and decisions

Make a creator's own wardrobe useful for a repeatable journey: capture a garment, recreate inspiration, build a personal outfit, and prepare an honest post. The AI agents are required for launch. The current manual studio is the foundation, not the finished AI product. Preserve the cream, neutral and fuchsia design and existing destinations.

Use a server-side coordinator that invokes one specialist per explicit user action. No autonomous background agents, multi-agent debates, recursive tool loops or automatic posting. This controls cost and makes each recommendation traceable. Development agents are separate and remain off to conserve the owner's Codex usage.

## Customer-facing specialists

| Agent | Trigger and input | Proposed output | Customer control |
| --- | --- | --- | --- |
| Capture assistant | User asks to analyze one uploaded garment photo | Suggested name, category and color; uncertainty notes | User reviews and edits before saving. Never infer price or a brand from an unrecognizable label. Does not claim background removal. |
| Look Spotter | User supplies one inspiration photo and selects a bounded set of their own garments | Visible outfit elements paired with owned garment IDs, substitutions and missing pieces | User accepts a pairing or edits it. No invented matching percentages or claims to identify a person. |
| Gatekeeper stylist | User selects occasion, aesthetic, locked pieces and wardrobe candidates | One wearable outfit using owned garment IDs, explanation and optional swaps | Locks are mandatory. User decides whether to place it on the canvas. Describe incomplete wardrobes honestly. |
| Creator assistant | User selects a saved outfit and tone | Caption and a short filming outline based on that outfit | User edits and exports. No TikTok posting, fabricated trend claims, reach forecasts, or insults about bodies. |

## What should be distinctive

The proposed product differentiation is the combination of wardrobe-grounded suggestions, locked-item constraints, explainable substitutions and a path from inspiration to a creator-ready outfit. Develop and evaluate these behaviors explicitly; a generic chat interface is not sufficient.

Maintain versioned specialist instructions, an occasion/aesthetic taxonomy, selection rules, approved evaluation cases, feedback handling and composition-to-export behavior. Keep algorithmic selection/validation separate from model prose. Do not label randomness as AI. Model/provider choice must be replaceable without rewriting these product rules.

This is an engineering inventory of potentially distinctive work, not a legal determination of ownership, patentability, trademark availability or exclusivity. A model, third-party library, public fashion convention, or customer-uploaded photo is not automatically app-owned IP.

## Data, privacy and trust

- Authenticate before generation. Load images and garment candidates on the server under the requesting user's ID; never trust client-provided image URLs or an unrestricted list of IDs.
- Before first photo analysis, explain that selected images are sent to the configured AI provider. Uploading a photo alone must not trigger analysis.
- Treat image text, garment names, captions and reference descriptions as untrusted data, not executable instructions. Provider output cannot authorize tool actions or access another account.
- Validate structured responses and owned garment IDs. Reject unknown IDs, duplicates and missing locks. Present failure with a retry action; manual tools remain available and are clearly labeled.
- Never send passwords, recovery codes, sessions, unrelated photos or complete account history. Logs contain request metadata and usage, not private photos or prompts by default.
- No cross-customer learning, training corpus or reuse of customer photos without a separately defined permission mechanism.

## Initial cost policy (product limits, not provider pricing)

- One provider request per customer action; no automatic retries. Duplicate submissions share one persisted request via an idempotency key.
- At most 40 garment candidates and one photo per request. At most 1,200 output tokens. Bound free-text fields and image dimensions before calling the provider.
- Initial allowance: 10 generation requests per account per UTC day, enforced transactionally. Also require an owner-configured global daily spending cap before enabling production AI.
- Reserve budget before dispatch, record actual provider usage when available, and reconcile uncertain/time-out outcomes without silently assuming zero cost. No paid requests if provider pricing/budget configuration is missing.
- Provider and model are allowlisted server configuration. The customer cannot choose arbitrary models, tools, URLs or token limits.

## September 12 priority update

Photo identification and sourced shopping discovery are the immediate release priority. Capture now has a real Gateway implementation and the shopping agent searches Perplexity, then selects product sources by index. The UI labels alternatives and possible exact matches separately; it never promises identity, price or stock based on snippets. Live evaluation and hosted verification remain required before calling this ready.

Discovery uses at most one vision generation per scan and two bounded generations per shopping action (search, then source selection), with 2,000 output tokens per generation and no automatic SDK retries. This supersedes the earlier one-call/1,200-token rule for this flow. Gemini 2.5 Flash is the initial free-tier-compatible model; Gemini 3.x was rejected on this account. Free-tier provider rate limits may block real-world usability and must be resolved before launch.

Next product addition: **Top 10 clothing trends of the month**. Use a shared monthly, region-specific result rather than a new paid search per visitor. Each card needs a named trend, dated supporting sources, clear selection criteria, links to shopping discovery, and an action to recreate it using owned garments. Call the section a curated selection unless a source supports an actual ranking. Do not fabricate TikTok views, growth figures or popularity. Show the month and last refresh; retain an honestly dated previous edition if the provider fails. This is planned, not implemented.

## Required implementation, in order

1. Define typed request/result contracts and validation tests (this batch).
2. Add request ledger, atomic per-user/global budget reservation, idempotency and status recovery.
3. Select an available authenticated provider/model; verify its current capabilities, pricing and data handling before configuration. Do not repurpose the old editor's Firebase credentials.
4. Build Gatekeeper stylist through a real provider first, with owned-ID/lock validation and visible error states. Wire the existing canvas to user-approved results.
5. Add explicit photo-analysis consent and real Capture/Spotter analysis. Integrate Creator assistant with the existing preview/export flow.
6. Run the agent evaluation suite and cost/failure checks; test hosted behavior before launch.

## Release acceptance

- Real provider responses demonstrated in the hosted app for all four specialists; no fixture or canned fallback passed off as model output.
- Empty/sparse closet, conflicting constraints, unknown IDs, missing locks, malformed output, timeout, exhaustion and duplicate click scenarios pass.
- No cross-account access. No model-induced data changes or external posting. User approval precedes saving a generated proposal.
- Personal styling remains about garments, color, occasion and stated preferences; no invented knowledge of a person's identity or body.
- Budget accounting, provider errors and generation status visible to the operator. The global cap is configured and tested.
- Evaluation fixtures are synthetic or permission-cleared and contain no copied customer data. Product quality results are recorded, not inferred from the presence of an API key.

## Source and asset handling

Keep a provenance record for original code, prompts, evaluation cases, fonts, icons, dependencies and any supplied brand assets. Inspect the repository visibility before publishing specialist instructions: the repository was public when discovered. Confidential instructions should not be added to a public remote. No private customer information belongs in Git. Any licensing or ownership decision that requires legal interpretation needs separate review.

## Status

Implemented and exercised: Capture, Look Spotter, Gatekeeper stylist, sourced Shopping and Creator; authenticated Gateway calls, transactional budget ledger, cached results, consent copy, owned-ID validation and private feedback. Provider generation receipts now support reconciliation of completed results with known costs. Interrupted requests without complete evidence keep their reservations.

The historical proposal above is superseded by these release choices: Gemini 2.5 Flash through the funded Vercel Gateway; up to 2,000 output tokens for Capture/Shopping, 1,200 for stylist, and 900 for Creator. Shopping has two bounded stages; other actions use one generation. No automatic paid retries. Initial shared cap is $1/day, with a $0.10 reservation per action and ten actions/account/day; reservations are not quoted provider prices.

Monthly trends are implemented as dated, manually reviewed editorial editions in Git, with public caching and no per-visitor AI calls. They are not autonomous trend monitoring. Cutouts remain internal at the owner's request. Stripe is excluded from this release. See DELIVERY_PUNCH_LIST.md for deployed evidence and remaining release gates; implementation alone does not establish production readiness.
