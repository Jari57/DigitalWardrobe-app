# PWA verification and offline policy

Manifest: standalone, same-origin start/scope, regular 192/512 icons, safe-area maskable icon and Apple touch icon. Icons are derived from our existing logo using scripts/build-icons.mjs. Install affordance and Safari instructions are included. No push notification permission requested.

Service worker caches exactly offline.html and three public icons. Navigations are network-only with a static offline fallback. All APIs, photos, authenticated HTML, AI results and JavaScript bundles bypass its cache. Sign-out has no private service-worker cache to clear; application state is reset by the existing sign-out path. Existing open-page edits stay in memory when connectivity drops. Offline mutations fail with a reconnect message.

Updates wait for explicit Reload for update, with a save-first message; no forced reload during editing. Activation deletes older wardrobe cache versions. Worker fetches itself normally under browser service-worker update semantics.

Verified in automated Edge browser: manifest/icon availability, worker activation, exactly four public cached paths after API access, offline navigation, and recovery after reconnect. Original export/share contract and 1080×1920 output regression pass. Light/dark/system and narrow viewport checks pass separately.

Not yet verified: physical iPhone Safari installation, physical Android Chrome installation, actual OS share sheets, and update transition between two deployed worker versions. Emulation does not establish those checks. Launch checklist must keep these open until observed.
