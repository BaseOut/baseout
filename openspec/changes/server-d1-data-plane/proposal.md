# server-d1-data-plane

> **Depends on**: [`server-d1-backend`](../server-d1-backend/proposal.md) (provision/deprovision/query-executor arms — shipped 2026-08-24/25, blocked on the account token for live smoke). **Out of scope here**: records-sync, comments, media, automations/interfaces MCP sections, health/AI, and the remaining ~40 brokered routes — those follow the same pattern later if D1 demand warrants it.

## Why

`server-d1-backend` made `backend: 'd1'` provisionable: the engine can create the database, apply the full sqlite DDL, and tear it down. But every data route still answers 501 for d1, because the entire per-Space I/O layer (`space-db-pg.ts` + friends) is drizzle-over-postgres. Practically that means token day yields an **empty shell**: a D1 Space provisions but a schema backup cannot land in it and Browse cannot read it.

Dan's 2026-08-24 direction is "every space should have a D1 database … with configuration info". The minimum data plane that honors that is the **schema path**: schema-sync writes the captured schema into the Space's D1; schema-read serves the Browse tree from it. This change builds exactly that slice — nothing more — so the only thing the missing `CLOUDFLARE_D1_API_TOKEN` adds later is transport.

## What Changes

Engine (`apps/server`) only. No new secrets, no web change, no workflows change.

### 1. D1 space-db I/O module (`lib/per-space/space-db-d1.ts`)
The sqlite twin of the schema slice of `space-db-pg.ts`, written against the `SpaceD1Executor` interface (so unit tests run it on Node's real SQLite and production runs it over the D1 HTTP query API):
- `ensureBaseRun` — select-or-insert the per-(backup_run, base) row (UUIDs minted in JS; sqlite has no gen_random_uuid default).
- `readSchemaWorkingSet` — prior bases/tables/fields/views in the exact `PriorWorkingSet` shape `schema-diff.ts` consumes (the pure diff is already backend-agnostic).
- `applySchemaDiff` — schema_versions (hash-deduped via the existing `bo_at_schema_versions_base_hash_uq`), base_run stamps, lifecycle upserts, schema_updates rows.
- `readAllEntities` — the Browse-tree read, same payload shape as the pg version (incl. `extractFieldConfig` enrichment and removedAt resolution).
- View regeneration via the shipped `query-views-sqlite.ts` builders when records are enabled.

### 2. Route dispatch (d1 arms)
- `schema-sync`: `backend === 'd1'` runs the core path (base run → working set → diff → apply). MCP views/interfaces/automations sections, synced-view inference, AI descriptions/health, and the lazy schema upgrade are **explicitly skipped** on d1 (reported per-section, never silently) — fresh D1 provisions are already at the current schema version, and those subsystems are pg-coupled today.
- `schema-read`: d1 arm serves the unscoped Browse read; the scoped variant keeps 501 with a distinct reason until it's needed.

### 3. Atomicity caveat (recorded, accepted)
The D1 HTTP query API has no cross-request transaction. A failed sync can leave a partial write; every write here is an idempotent upsert keyed on natural ids, so the retry (next backup run) converges. Recorded in design.md as the d1-tier trade-off.

## Impact

- Affected code: `apps/server/src/lib/per-space/` (new `space-db-d1.ts`), `pages/api/internal/spaces/{schema-sync,schema-read}.ts`, `lib/per-space/resolve.ts` (locator selection).
- Tests: the new module runs against **real SQLite** (`node:sqlite`) with the **real bundled DDL** (`SPACE_SQLITE_DDL`) — which doubles as a standing proof the DDL applies cleanly.
- Security: no new secrets or surfaces; d1 queries ride the already-typed `CLOUDFLARE_D1_API_TOKEN`.
