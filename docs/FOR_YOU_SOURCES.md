# For You source expansion

September 26, 2026. Implemented locally; not deployed.

The configured source registry expands from two publishers to ten: Who What Wear, ELLE, Harper's Bazaar, Esquire, Fashionista, The Guardian, Hypebeast, Highsnobiety, GQ and Vogue. These are candidate publisher endpoints, not ten verified live integrations. The web research tool could not read feed bodies (some responded with unsupported XML/octet-stream types); command-line network access remains unavailable. Each source still needs a live ingestion and image check before production readiness can be claimed.

Source-specific article paths replace the previous universal /fashion/ restriction. RSS and Atom titles, links and timestamps are normalized; descriptions are never rendered as HTML. Media tags, image enclosures and embedded image URLs are considered only through the explicit image-host allowlist. CSP and server-side image validation share that allowlist. Unsupported hosts stay unavailable rather than widening access to arbitrary images. Original attribution and links remain; feed availability alone does not establish commercial image reuse rights.

Refresh attempts all configured sources concurrently with a ten-second per-source deadline, one-MB body cap, at most three same-publisher redirects, and the existing shared refresh cooldown. At most 150 source-balanced articles are upserted per refresh. Partial failures preserve existing stories and saves.

Reads load up to 30 current stories per publisher, avoiding an early global database limit that could exclude smaller publishers. For You interleaves publishers after personalized ranking while preserving each publisher's relative rank. Latest stays chronological. Source details distinguish current stories, unavailable sources, pending checks and empty selections. No AI calls are added.

Fixture validation covers all ten URL policies, RSS/Atom parsing, image-host rejection and publisher balancing alongside the daily UX and authenticated-refresh tests. Fixture tests are not live source verification. Broader creator/community and retailer sources require supported integrations or user-provided content; this change does not ingest private Instagram, TikTok or Pinterest feeds.
