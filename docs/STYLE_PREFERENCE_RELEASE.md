# Clothing preference release

Interprets the owner's "genda" request as an explicit clothing preference: Womenswear, Menswear or Both. No gender is inferred from names, photos, bodies, or clothing colors. Existing users initially see mixed coverage until they choose.

The selector appears directly on For You. For authenticated accounts it saves a mutually exclusive style-interest tag through the existing authenticated preference endpoint. Guest selection applies to the current feed session. The tag uses the existing aesthetics array, so there is no database migration or new identity field. Existing aesthetic and category choices are preserved. The preference applies to For You and Latest, never to Saved.

Article targeting uses explicit menswear/womenswear title wording first, then a broad publisher editorial-focus fallback for GQ/Esquire and Who What Wear/ELLE/Harper's Bazaar/Vogue. Other stories remain shared/unknown and can appear for either choice. This is coarse article relevance, not garment-level gender classification. Publisher balancing still applies after filtering.

Saved preferences also inform outfit generation and shopping search/ranking as a soft clothing-department preference. Explicit requests, locked and owned pieces, and the pictured garment take precedence; unisex options remain eligible. Changing the preference makes the corresponding outfit and shopping cache entries distinct, while photo detection remains reusable. Changing a preference alone never starts a paid AI generation.

Verification: production build, TypeScript and formatting passed; seven targeted checks passed, covering preference replacement, cross-audience title handling, saved-item preservation, source ingestion contracts/diversity, refresh authorization, cache separation, and mobile selection-to-save plus feed refresh. UI requests use fixtures; persistence is implemented through the existing owner-scoped upsert but was not retested against production Neon in this environment. Live model quality and production shopping results have not been evaluated for these new preference instructions.

Rollback consideration: older runtime preference validation does not recognize the new audience interest tags. Before rolling back to that older runtime, preserve a backup of TrendPreference and remove only womenswear, menswear and all-styles from its aesthetics arrays, or backport support for those tags to the rollback build. Do not alter other interests or saved content.

Production attempt on September 26 was rejected by the Vercel connector: "MCP tool call requires approval, but approval policy is never." CLI access to GitHub also failed; the Vercel CLI is not on this session's PATH. No production release, remote branch update, or live source ingestion verification was completed. The combined portable patch includes the UX, source, and preference changes, based on 27f09767147296ff750106cfc19b911cc770c0a8.
