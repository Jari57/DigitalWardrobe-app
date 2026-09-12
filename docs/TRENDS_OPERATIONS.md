# Monthly editorial editions

September 2026 launches with ten reviewed US/UK fall-focused picks. Each claim links to dated Vogue or Who What Wear coverage; our separately labeled styling ideas are original suggestions. These are not measured TikTok rankings or global/region-specific popularity statistics.

Editions live in src/content/trends and are validated against trendEditionSchema. Publish a new JSON edition only after checking its sources, dates and relevance, then register it in api/trends/route.ts, run trends.spec.ts and deploy. Fewer than ten supported picks is valid. Automated research/refresh is not configured; editorial publication is an intentional cost-control choice for this release. Readers trigger zero AI calls. Git persists editions and the public endpoint allows a one-hour shared cache. No account/wardrobe data enters that response.

If the month changes before an edition is ready, the last published edition remains visible with a Previous edition label. Future editions are not shown early. A missing edition shows a preparation state. Source outages do not remove the reviewed edition. Search shops opens an external shopping search, not verified stock; closet styling opens the existing explicit AI action without automatically charging.
