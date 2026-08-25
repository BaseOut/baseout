# server-d1-backend — design

## Context

`system-per-space-db` shipped the model (backend × records_enabled posture, dual-dialect schema, engine-brokered reads) with only the `managed_pg` factory implemented. The `d1` arm was deferred solely on the missing Cloudflare API token. The 2026-08-24 sync approved real Cloudflare provisioning, so this change fills in the arm. Everything here follows the shapes `provision-pg.ts` / `schema-read-io.ts` / `query-views.ts` already established — D1 is a second implementation of existing seams, not a new architecture.

## Decisions

### D1 — REST API for lifecycle, HTTP query API for data
Per-Space D1 databases are created/deleted via the Cloudflare REST API and queried via the D1 HTTP query endpoint (`POST /accounts/{a}/d1/database/{uuid}/query`, batched statements + params). A static `d1_databases` Worker binding is impossible for runtime-created databases, so the engine talks HTTP for both planes. The query executor lives behind the same injected-IO seam as the postgres-js executor so all brokered routes and unit tests are backend-agnostic.

### D2 — Naming + locator
`baseout-{env}-space-{spaceId}` (validated: D1 names ≤ 64 chars, `[a-zA-Z0-9-_]`; Space IDs are UUIDs → fits). The `space_databases` row records `{ d1_database_id (UUID), d1_database_name }` as the locator — the UUID is what the query API addresses; the name exists for dashboard legibility. Pure resolver function first (TDD), mirroring `resolveManagedBucketName`.

### D3 — Schema application at provision time
Creation runs the sqlite DDL from `packages/db-schema` (the same source the parity tests pin) via the query API in one batch, then stamps `SPACE_SCHEMA_VERSION`. Upgrades ride `system-per-space-upgrade`'s sqlite steps; this change only guarantees a fresh database lands at the current version.

### D4 — Views: query-time pivot, no matviews
SQLite has no materialized views and per-Space D1 sizes are entry-tier by definition. The `d1` arm answers per-table reads with the live pivot (the sqlite flavor of `query-views.ts`'s builders as plain `CREATE VIEW`s, applied at provision + schema-sync). If profiling ever shows this too slow, promotion to Growth-tier `managed_pg` is the documented answer — not a D1 caching layer.

### D5 — Token scope + storage
`CLOUDFLARE_D1_API_TOKEN`: account-scoped, permission **D1:Edit** only. Held as a Cloudflare Secret on the engine Worker (all envs), `.dev.vars` for local. Never in web, never in workflows (workflows touches per-Space data only through engine internal routes). Rotation procedure documented in ops-setup.md. This is deliberately a separate token from any future R2-admin token — one capability per credential.

### D6 — Error taxonomy parity
The factory returns the exact `ProvisionResult` codes `provision.ts` already defines; `backend_not_implemented` disappears for `d1` and remains for `byodb`. Existing posture validation (`isolationClassForBackend`, records gating) is untouched.

## Risks / edge cases

- **[Runtime API dependency]** provisioning now depends on Cloudflare API availability. Mitigation: provisioning is already an async state machine (`provisioning` → `active`/`error`) with retry semantics; a Cloudflare outage marks `error`, never wedges.
- **[Query API latency]** HTTP-per-query is slower than a binding. Acceptable for entry-tier posture; measured in the smoke task before enabling for real Spaces.
- **[Token blast radius]** D1:Edit can delete any D1 database on the account. Scope cannot be narrowed per-database (Cloudflare limitation) — recorded as an accepted risk; deletion paths are idempotent-guarded and only reachable through the INTERNAL_TOKEN-gated deprovision route.
- **[Rate limits]** 1200 requests/5min on the Cloudflare API; per-Space provisioning is far below it. Batch DDL into single query calls.

## Migration Plan

1. Pure pieces (TDD): name resolver, DDL batch builder, locator (de)serialization.
2. `provision-d1.ts` factory behind the existing seam + `space_databases` locator columns (master-DB migration, web-owned per repo rules — coordinate the mirror header).
3. Query executor arm in `per-space/resolve.ts` + sqlite view builders.
4. Deprovision arm.
5. Token generation + ops-setup.md + `.dev.vars` sync (same change).
6. Smoke: provision a real Space on `backend: 'd1'` in the dev env, run a schema-only backup into it, read it back through a brokered route, deprovision. Verify in the Cloudflare dashboard the database appears and disappears.
7. Rollback: the arm is additive — reverting re-yields `backend_not_implemented`; any created databases are cleaned by the idempotent deprovision sweep.
