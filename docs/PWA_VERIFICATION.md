# PWA verification and offline policy

Manifest: standalone, same-origin start/scope, regular 192/512 icons, safe-area maskable icon and Apple touch icon. Icons are derived from our existing logo using scripts/build-icons.mjs. Install affordance and Safari instructions are included. No push notification permission requested.

Service worker caches exactly offline.html and three public icons. Navigations are network-only with a static offline fallback. All APIs, photos, authenticated HTML, AI results and JavaScript bundles bypass its cache. Sign-out has no private service-worker cache to clear; application state is reset by the existing sign-out path. Existing open-page edits stay in memory when connectivity drops. Offline mutations fail with a reconnect message.

Updates wait for explicit Reload for update, with a save-first message; no forced reload during editing. Activation deletes older wardrobe cache versions. Worker fetches itself normally under browser service-worker update semantics.

Verified in automated Edge browser: manifest/icon availability, worker activation, exactly four public cached paths after API access, offline navigation, recovery after reconnect, and explicit activation of a waiting worker followed by reload. The update test registers a second script URL in an isolated browser context and verifies controller replacement. Original export/share contract and 1080×1920 output regression pass. Light/dark/system and narrow viewport checks pass separately.

Not yet verified: physical iPhone Safari installation, physical Android Chrome installation, actual OS share sheets, and update transition between two deployed worker versions. Emulation does not establish those checks. Launch checklist must keep these open until observed.

## Screenshot handoff and guided entry

The app now opens directly on screenshot shopping for guests and returning accounts. Upload, Identify and Shop are shown as a compact current-step indicator. Screenshot selection exposes Identify; detected pieces expose Find where to buy. A collapsed help section explains taking a screenshot, Android PWA sharing where supported, and iPhone manual upload. Closet recreation stays secondary.

The manifest accepts one JPEG/PNG/WebP file at /share-target. The controlling service worker redirects to a random one-use handoff URL and passes the File to that client through a MessageChannel. Files are held only in worker memory, bounded to four pending shares and two minutes, and removed on consumption. No Cache Storage, IndexedDB, server upload or AI action occurs during handoff. Worker termination or an unsupported/empty share falls back to manual upload. A shared social-media URL alone is not an image. A server fallback redirects without parsing or storing the image.

Verified: production build, local controlled-worker multipart share, preview, cleared handoff URL, no automatic uploads/AI, no private cached files, reload clearing the photo, invalid-share fallback, existing screenshot entry, public-only offline caches and worker update activation. Physical Android Share menu registration and iPhone upload remain device acceptance checks. Existing installs may need the offered app update and the browser's manifest refresh before Wardrobe appears in Share.

Platform references: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target and https://web.dev/articles/files/receive-shared-files .
