# server-d1-backend

> **Depends on**: [`system-per-space-db`](../system-per-space-db/proposal.md) (per-Space DB model; `managed_pg` backend shipped; `d1` explicitly deferred in its task 2.1). **Coordinate with**: [`system-per-space-upgrade`](../system-per-space-upgrade/proposal.md) (schema-version upgrade path — D1 gets the sqlite dialect of every upgrade step). **Out of scope here**: backend migration jobs (`system-per-space-db` 6.1), document-body relocation (`system-r2-bucket-topology` T5).

## Why

The per-Space DB model (`system-per-space-db`) mandates a dedicated database per Space, with Cloudflare **D1** as the entry-tier backend: PRD §"Client DB — entry" (D1/SQLite), the tier ladder (Launch = schema-only D1, Growth = full D1), and the migration requirement (D1 → PG on upgrade). The dual-dialect schema shipped long ago (`packages/db-schema/src/space/sqlite.ts`, parity-tested against `pg.ts` at every version bump) — but the engine's provisioning factory only implements `managed_pg`; `backend: 'd1'` returns `backend_not_implemented` and zero D1 databases exist on the Cloudflare account.

In the 2026-08-24 Dan/Autumn sync the Cloudflare pivot was **officially approved**: stop defaulting to local/test storage, provision real Cloudflare resources per the specs — "every space should have a D1 database for configuration info, even when records are stored dynamically in Postgres." This change is the implementing home for that approval on the D1 axis (the R2 axis is `system-r2-launch` + `system-r2-bucket-topology`).

## What Changes

Engine (`apps/server`) code + one new secret. No web UI change (backend choice is posture-driven per `system-per-space-db`; the engine brokers all per-Space reads uniformly, so a working `d1` backend slots in behind existing routes).

### 1. D1 provisioning backend
- `provisionSpaceDatabase(backend: 'd1')` creates a real D1 database via the **Cloudflare REST API** (`POST /accounts/{account_id}/d1/database`) — workerd cannot create D1 databases at runtime any other way (confirmed in the 2026-08-24 sync: the dashboard cannot create per-Space bindings either; API is the only programmatic path).
- Naming: `baseout-{env}-space-{spaceId}` (immutable Space ID, mirroring the per-org R2 bucket convention from `system-r2-bucket-topology` T1). Name recorded on the `space_databases` row as the `d1` locator (database UUID + name).
- Idempotent + concurrency-safe: treat "already exists" as success; single-writer gate on the `space_databases` row (same pattern the `managed_pg` factory uses).
- Applies the current per-Space sqlite DDL (from `packages/db-schema` space/sqlite) at creation, stamped with `SPACE_SCHEMA_VERSION`.

### 2. Query path
- Engine read/write brokering reaches the per-Space D1 over the Cloudflare D1 **HTTP query API** (`/d1/database/{uuid}/query`) — per-Space D1 databases cannot be static Worker bindings (bindings are deploy-time; Spaces are created at runtime).
- The existing per-space resolve layer (`apps/server/src/lib/per-space/resolve.ts`) grows a `d1` arm returning a query executor with the same interface the `managed_pg` arm exposes; brokered routes stay untouched.
- Per-table query views: D1/SQLite has no materialized views — the `d1` arm serves the live-pivot equivalent noted in `system-per-space-db` 4.2 (plain views or query-time pivots; decided in design.md).

### 3. Deprovision teardown
- `deprovisionSpaceDatabase` gets its `d1` arm: `DELETE /accounts/{account_id}/d1/database/{uuid}`, idempotent (missing database = success), then the `space_databases` row delete — mirroring the shipped `managed_pg` teardown.

### 4. New secret: `CLOUDFLARE_D1_API_TOKEN`
- A **scoped** Cloudflare API token (D1:Edit on this account only — least privilege per CLAUDE.md §3.3) held by the engine Worker as a Cloudflare Secret. This was the explicit deferral reason in `system-per-space-db` 2.1.
- Runbook impact: documented in `shared/internal/ops-setup.md` (token generation + rotation + which envs hold it) in the same change that generates it. `.dev.vars` carries the dev value per the standing sync rule.

## Impact

- Affected specs: implements the `d1` arm mandated by `system-per-space-db`; unblocks Launch/Growth-tier provisioning postures.
- Affected code: `apps/server` (`lib/provisioning/*` — new `provision-d1.ts` alongside `provision-pg.ts`; `lib/per-space/resolve.ts` + query layer; teardown), `apps/server/.dev.vars(.example)`, `shared/internal/ops-setup.md`.
- Security review points (§3.3): one new secret (`CLOUDFLARE_D1_API_TOKEN`, scoped D1:Edit), one new external API surface (Cloudflare REST from the engine), no new public routes.
- Cost note (2026-08-24 sync): creating D1 databases per Space is inside the approved Cloudflare pivot; D1 free-tier limits are generous, but the design records the per-database cost model so growth is surfaced, not silent.
