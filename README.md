# Digital Wardrobe Studio

A private wardrobe and outfit studio built with Next.js, TypeScript, Prisma and PostgreSQL. Each account starts empty. Uploaded photos are validated, normalized, stripped of metadata and served only to their owner.

## Working features

- Username/password accounts with one-time recovery codes and private sessions.
- Photo upload, garment editing/deletion, search and filters.
- Outfit composition, stored geometry, Blind Fit selection and locks.
- 1080 × 1920 PNG export and progressive Web Share support.
- Saved looks, explicit wear logging, factual cost-per-wear statistics.
- Inspiration photos manually paired with wardrobe pieces.

AI analysis and billing are not enabled. No preset results are presented as AI.

## Development and checks

Use Node.js 22 or newer. Install with `npm ci`. Provide `DATABASE_URL` in a private environment file; use `.env.example` as the key reference. Next.js reads `.env.local`; Prisma commands can be run with `node --env-file=.env.local node_modules/prisma/build/index.js migrate deploy`.

Run `npm run build`, then `npm test` for the creator browser regression. Playwright starts the production build on port 3100 and creates/deletes its own temporary account. Windows uses installed Microsoft Edge; other platforms need Playwright Chromium (`npx playwright install chromium`). Do not run against a database containing unrelated test fixtures you cannot distinguish from production data.

Run `npm run test:flows` against a running app on localhost:3000 for account isolation, upload validation, saved geometry, wear idempotency and recovery checks. `TEST_BASE_URL` can select another test deployment. Test accounts are cleaned up through the account API.

## Deployment

The existing Vercel project is configured by `vercel.json`. Its build applies committed migrations before compiling. `/api/health` verifies both connectivity and the application schema. Secrets belong in Vercel environment variables, never Git or client bundles. Export/recovery files are private to their user.

Production promotion requires hosted validation and real-phone sharing checks. See `IMPLEMENTATION_STATUS.md` for the current release checkpoint and known unfinished work.
