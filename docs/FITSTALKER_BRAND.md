# FitStalker

Primary production origin: https://fitstalker.com. The www domain redirects to the apex with HTTP 308. Both belong to the existing Vercel project digital-wardrobe-app; keep its database and Firebase project digitalwardrobe-app unchanged.

Brand promise: **See the fit. Find the pieces.** The main workflow opens on screenshot upload, then explicit clothing identification, then shopping per garment. Shopping results are similar pieces unless evidence supports a possible exact match.

Visuals: warm ivory, charcoal, muted rose; generated FS viewfinder monogram. Source images live in public/brand. Run `node scripts/build-icons.mjs` to produce browser, Apple and maskable PWA icons. Original artwork was created using built-in image generation, not downloaded from a third-party brand.

Generation brief: original premium FitStalker wordmark with a compact angular FS viewfinder monogram, ivory #faf7f2 and charcoal #30212c, muted rose #e7cbd4 accent, no neon or surveillance imagery. Exact tagline: See the fit. Find the pieces. Refined to high-contrast flat backgrounds; icon exported separately with a maskable safe area.

Firebase authorized domains include fitstalker.com and www.fitstalker.com while preserving previous domains. Google provider display name is FitStalker. The existing Firebase-hosted OAuth handler remains in use. New-domain sessions require sign-in; account data is shared in the same database. Browser-local themes and installed PWAs are origin-specific; install from the new domain for the new address.

Validation: production build, formatting, screenshot-entry, share-target and PWA browser tests pass. Stripe remains disabled. Physical-device installation and an owner-completed Google login remain user-device checks.
