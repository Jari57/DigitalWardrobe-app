# For You feed operations

For You replaces the monthly-list entry point with large publisher photos and short article cards. Light/dark themes use the existing muted palette. Likes, saves, hidden items and explicit style/type preferences are private to the signed-in account. Saved items remain accessible beyond the fresh-feed window; hide has an undo action.

## Refresh and ranking

Vercel cron calls GET /api/cron/trends at minute 17 each hour. Production CRON_SECRET is required and checked with a constant-time comparison. The Pro plan supports this schedule. A database lock prevents overlap and repeated refreshes within 45 minutes. Fetches are bounded to two sources, 10 seconds and 1 MB each; no AI calls are made by refresh or feed browsing.

Sources: https://www.whowhatwear.com/feeds/all and https://www.elle.com/rss/fashion.xml. Only HTTPS fashion article URLs from their original domains are accepted. Clothing/accessory keywords filter out general event news. Entries older than 14 days, future dates and explicitly sponsored entries are excluded. RSS image URLs are restricted to the publishers' two image CDNs. Cards link to original coverage and show publisher attribution; photo credits appear under Why this. Failed images have a fallback. Keep photo usage and publisher syndication permissions under review before expanding commercial distribution.

The public feed uses recency; signed-in ranking also uses selected styles/types and bounded weights from likes, saves and hidden items. Shopping region guides external shopping searches only. These are US/UK editorial sources, not measured regional demand. Why this explains relevance. Source failures retain existing stories and show degraded freshness. Items are deduplicated by canonical article URL. The database is shared across deployments; migration 006 is additive.

## Verified and remaining

Local production build passed. Ten targeted checks passed, including live RSS ingestion, real image loading, light/dark mobile layouts, 320px overflow, private preferences/bookmarks, hide/undo, cron authentication/reuse, creator flow, onboarding and PWA regression. Reading the feed made zero AI calls.

Hourly scheduling is configured; verify a scheduled production execution in Vercel logs after deployment. Actual TikTok momentum is NOT connected. This release must not claim verified viral rankings. Next work: obtain a permitted signal source with item-level timestamps, region, category and momentum evidence; deduplicate incremental updates and validate relevance with real creator feedback. Also evaluate category coverage and larger-history pagination, source/photo permissions, and retention of old unsaved articles. No automatic paid social-data subscription is authorized.

## Historical editions

The older monthly JSON editions and /api/trends remain as a source-backed archive. They do not drive For You. No new monthly-only publishing requirement should be inferred from older release notes.
