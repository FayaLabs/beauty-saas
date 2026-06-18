# Legacy migrations (frozen 2026-06-17)

These are the historical SQL migrations that built this project's live database
BEFORE adopting the Fayz migration architecture (Drizzle + plugin companion SQL).

**Do not add to or run these.** The live DB already embodies them. They are kept
as provenance + a disaster-recovery fallback for fresh provisioning until the
spine home in `@fayz-ai/db` is smoke-tested against a blank DB.

Going forward: tables via `pnpm db:generate` (Drizzle), everything else via plugin
`src/migrations/*.sql`, applied with `pnpm db:apply`. See
fayz-sdk/docs/design/MIGRATION-ARCHITECTURE.md.
