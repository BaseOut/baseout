## Why

The per-Space schema has grown across this batch — v3 (Health metric tables), v4 (synced-view candidates), v5 (chat threads/messages) — but provisioning was all-or-nothing: `applyManagedPgSchema` probes `bo_at_bases` and **skips the DDL entirely** if the schema exists. So an existing Space stays frozen at its provisioned version, and the Health/Relationships/Chat tabs 500 (missing tables) until a manual re-provision. This change adds an **in-place lazy upgrade** so existing Spaces self-heal — removing the "re-provision required" caveat from `server-schema-health-scoring`, `server-relationships`, and `server-schema-chat`.

## What Changes

- **Idempotent DDL**: `spacePgDdlStatementsIdempotent()` rewrites the bundled provisioning DDL to `CREATE TABLE/INDEX IF NOT EXISTS` form so the full statement set can be re-run against a partially-populated schema (existing objects skipped, missing ones created). Correct **only while changes stay additive** (the invariant for v2→v5); a future ALTER needs a real migration step.
- **Upgrade helper** (`upgrade.ts`): `needsUpgrade(recorded, current)` (pure decision) + `upgradeManagedPgSchema(sql, schema)` (run the idempotent DDL) + `ensureSpaceSchemaCurrent(db, sql, {spaceId, pgLocator, schemaVersion})` — no-op when current; else run the DDL + bump `space_databases.schema_version`.
- **Lazy on-access**: the new-feature read entry points (`health-overview`, `relationships-overview`, `chat-threads`, `chat-thread`, `chat-send`) call `ensureSpaceSchemaCurrent` before touching per-Space tables; `schema-sync` calls it best-effort each backup. First stale access pays the (one-time) DDL; the steady state is one cheap version comparison.
- **Explicit trigger**: `POST /api/internal/spaces/:id/migrate-schema` for ops / a backfill sweep.
- `resolveSpaceDb` now returns `schemaVersion` (drives the decision).

## Capabilities

### New Capabilities
- `per-space-upgrade`: in-place, additive, idempotent upgrade of an existing Space's per-Space schema to the current version, run lazily on access + on backup + via an explicit route.

### Modified Capabilities
<!-- Unblocks the v3/v4/v5 features for existing Spaces; no master-DB migration. -->

## Impact

- `packages/db-schema/src/space/pg-ddl-upgrade.ts` (+ `./space/pg-ddl-upgrade` export) + `pg-ddl-upgrade.test.ts` (4).
- `apps/server/src/lib/provisioning/upgrade.ts` + `resolve.ts` (`schemaVersion`).
- Hooks in `health-overview` / `relationships-overview` / `chat-threads` / `chat-thread` / `chat-send` / `schema-sync`; new `migrate-schema.ts` route + `index.ts` wiring.
- Tests: `upgrade.test.ts` (needsUpgrade, 5) + `spaces-migrate-schema-route.test.ts` (3).
- **Security:** internal-only; idempotent DDL identifiers are the bundled, parity-tested schema (no user input); schema name derived from the validated Space id. **Invariant flagged**: additive-only — a non-additive change must add a real migration step, not rely on IF NOT EXISTS.
