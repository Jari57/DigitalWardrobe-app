# Generation receipts and recovery

Each provider generation is linked to its owning AgentRequest. Provider cost is stored in integer microdollars when available. Shopping saves the search receipt before beginning ranking, so a later failure cannot erase evidence of the first call. Accounts and generation receipts cascade on deletion; aggregate budget holds remain conservative after deletion.

The authenticated recovery endpoint checks at most five completed uncertain requests that have receipts. It settles only when every required generation has a valid cost: one for ordinary actions, two for shopping, or one when search completed with no eligible sources. Cost lookup never launches a generation. Missing results, missing receipts, partial shopping and provider timeouts retain their holds. Repeated settlement is transactional and idempotent.

Users can request this check from their AI allowance details. This does not promise recovery of a response never received by the app or automatic refunds. A provider error is not a successful empty shopping result. No automatic retry is permitted when previous spend is unknown.

Prisma migrations use scripts/migrate.mjs, which selects DIRECT_URL or derives Neon's direct hostname from DATABASE_URL. Runtime queries continue to use the configured pool. This prevents session advisory migration locks remaining attached to pooled connections. Never print connection strings in diagnostic output.

Automated coverage checks completion, partial-stage holds, repeat settlement and ownership. Live Creator generation and cached reuse passed after receipt integration. Physical devices and provider-side spending notifications require separate verification.
