# Private-image retrieval pilot

Status: standalone evaluator implemented; five mocked offline tests passed. No live provider validation, customer integration, account creation, credential, live upload or provider activation completed. Customer billing stays off. Account availability is awaiting owner confirmation.

## Candidate and prerequisites

Evaluate SerpApi Google Lens product retrieval alongside the current text retrieval. Its [Image API](https://serpapi.com/image-api) accepts JPEG, PNG or WebP bytes up to 500 KB and returns an image ID expiring after ten minutes. Pass that ID to the [Lens API](https://serpapi.com/google-lens-api) instead of publishing a screenshot URL. Country selection and product search are supported. Current [pricing](https://serpapi.com/pricing) lists 250 free searches per month; paid Starter is $25/month for 1,000. Confirm account entitlement and remaining allowance before evaluation; no paid plan is authorized.

- Owner supplies access to an existing or separately approved account. Store its key only in the server-side secret `SERPAPI_API_KEY`; never use a `NEXT_PUBLIC_` variable, browser code, Git, reports or screenshots. Do not ask the owner to paste the key into chat.
- Review provider retention and downstream processing before sending customer images. Image-ID expiry does not prove complete deletion. Lens documentation describes ZeroTrace as enterprise-only. Until terms are accepted, use only owned or explicitly permissioned evaluation fixtures.
- Start with the standalone opt-in evaluator, outside the customer request path. The manifest root must explicitly declare `permissionedForExternalUpload: true`; that declaration must reflect actual permission for every fixture. Normalize and strip image metadata locally; reject files that cannot remain useful below the upload limit. Keep existing authenticated customer photos private.
- Include provider activity in a separate pilot ledger. A SerpApi call does not automatically inherit the application's current AI budget enforcement. Do not enable a production provider until accounting, timeouts, response validation and fail-closed limits are implemented and tested.

## Stage 1: up to four product fixtures per run

The initial evaluator is limited to four product fixtures per invocation. It does not support negative fixtures yet and does not enable customer retrieval. Start with one clean known-product image, one screenshot, one alternate colorway and one lookalike, covering US, GB, CA and AU respectively when suitable permissioned fixtures are available. Do not invent truth or reuse an unsuitable product merely to fill a country slot.

Review the first run before deliberately adding a later batch. A four-case result is exploratory. No automatic loop should expand the pilot or repeat failed inputs. The following sixteen-case matrix is a future evaluation target, not an implemented or completed test suite.

After secure server-side configuration of `SERPAPI_API_KEY` and completion of the operator checks below, run:

```powershell
$env:LIVE_IMAGE_RETRIEVAL_EVAL='true'
node scripts/evaluate-image-retrieval.mjs path/to/manifest.json path/to/NEW-report.json
```

The report path must be new; the evaluator refuses to overwrite evidence. Manifest structure (URLs and file below are placeholders, not a test case):

```json
{
  "permissionedForExternalUpload": true,
  "cases": [
    {
      "id": "owned-product-01",
      "kind": "product",
      "file": "permissioned-reference.jpg",
      "country": "US",
      "category": "shoes",
      "expectedUrls": ["https://retailer.example.com/products/known-item"],
      "source": "https://retailer.example.com/products/known-item"
    }
  ]
}
```

Implemented bounds: one to four product cases; all files validated before upload, at most 10 MB and 25 megapixels each; normalized metadata-stripped JPEG at most 500,000 bytes. Each provider request has a 45-second timeout, a 1 MB response limit and no redirects. No retry or pagination. The entire run stops at the first provider error; unrun fixtures remain in the preregistered denominator. Reports retain image hashes, timings and candidate URLs without API keys, upload IDs or raw provider responses. These are offline-tested controls, not proof of live provider compatibility or result quality.

## Stage 2: proposed frozen 16-fixture comparison

Before the first request, record hashes, permission/source provenance, target garment, expected brand/model/colorway and eligible product URLs. Do not send truth labels or target URLs to either retriever. Freeze these inputs:

| Cases | Inputs                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| 4     | Clean known-product images: top, trousers, outerwear and shoes                                                            |
| 4     | Permissioned screenshots of known products, including two multi-piece looks                                               |
| 4     | Difficult known-product cases: alternate colorway, close lookalike, partial occlusion and visible screenshot text         |
| 4     | Negative cases: blank image, non-clothing, unrelated object and a look without independently established product identity |

Assign three of the twelve known-product cases to each supported country (US, GB, CA, AU), based on prereviewed eligible retailer pages. Assign negative cases US. A search returning nothing for the fourth negative is not automatically correct: review alternatives for relevance, while forbidding unsupported exact claims.

Once negative-case support is implemented and reviewed, run the unchanged baseline and candidate on the same frozen inputs and country assignments in deliberate batches of no more than four. Candidate: one image upload and one `type=products` Lens search per fixture; no automatic second search, query refinement, pagination or retry. Baseline: existing bounded detection/shopping flow, retaining all failures and its current allowance. If the existing cap cannot fund the complete baseline, pause and resume within ordinary later allowances; never increase caps or create accounts to evade them. The standalone retrieval report is raw candidate evidence, not output validated by the production shopping pipeline. Keep any later end-to-end validated results separate. Human-review results without changing the frozen answers after the run.

## Report the evidence separately

- Expected-product and preregistered-URL recall at ranks 1 and 5 across the twelve known cases. Record new valid retailers separately; never silently replace the original targets.
- Exact-label precision among results actually labeled exact, with sample counts; do not calculate precision when there are no exact labels. Review wrong colorways and lookalikes explicitly.
- Reviewer-accepted alternative rate and empty-result rate, separating intentional negative rejection from failed retrieval.
- Working product-photo fraction, direct product-page fraction, correct-country/currency fraction and independently verified local purchase availability. A country parameter alone proves none of these.
- Per-case and median/p95 latency, including upload time; timeouts and failures remain in the report. With sixteen cases, p95 is descriptive rather than a reliability claim.
- Requests, consumed credits and incremental provider cost; show baseline AI costs separately. Free-tier use is not a claim of zero future operating cost.

Use the existing exact identity, visual-conflict, ownership, URL safety and regional validation gates unchanged. Provider “exact matches” can describe image matches and must not directly create a verified-exact product label. Do not label a small pilot general accuracy or superiority.

## Operator stop rules and decision

The initial run permits at most four Lens searches and four uploads. Before each invocation, the operator must verify free-plan entitlement, available credits and upload charging, then record allowance before and after. Do not proceed if these are unclear. Stop on an unexpected charge, authentication failure, rate limit, privacy concern or repeated service failure; do not rerun failed inputs automatically. Before deliberately expanding toward sixteen fixtures, review the report and document the next batch. No paid-plan upgrade is authorized.

These entitlement, privacy, cumulative campaign and monetary-cost checks are operator requirements, not a claim of an automatic budget gate. The standalone tool does not inherit the application's AI budget or prove provider charges from local request counts. Consult the evaluator's actual implementation for its enforced timeout, input bounds and failure handling before running it.

Keep the pilot off in production unless reviewed results show improved usable, correct-country product recall with no additional false exact labels or privacy violations. Review photo coverage, latency and cost tradeoffs explicitly. A positive small pilot justifies a larger held-out evaluation, not an accuracy guarantee. Production activation remains a separate bounded implementation and review step.

Alternative: [Google Cloud Vision Web Detection](https://docs.cloud.google.com/vision/docs/detecting-web) accepts base64 bytes without public hosting, but is not Google Lens. It requires a billing-enabled Cloud project and API credentials; [Web Detection pricing](https://cloud.google.com/vision/pricing) is free for the first 1,000 monthly units, then $3.50/1,000 through five million. Its [data-usage policy](https://docs.cloud.google.com/vision/docs/data-usage) documents in-memory synchronous processing and no public sharing or training use. Retailer coverage still needs the same evaluation; do not activate both providers automatically.
