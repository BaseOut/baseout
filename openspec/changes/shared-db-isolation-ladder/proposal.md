# shared-db-isolation-ladder

> **Builds on**: [`system-per-space-db`](../system-per-space-db/proposal.md) (the per-Space DB data model + control/data-plane split + engine read broker; backends `d1 | managed_pg | byodb`) and [`system-per-space-upgrade`](../system-per-space-upgrade/proposal.md) (lazy in-place per-Space schema upgrade). **Gated by**: [`shared-entitlements`](../shared-entitlements/proposal.md) (the `database_isolation_class` enum feature + the `database_size` meter). **Owns** the backend/class migration job that `system-per-space-db` task 6.1 explicitly deferred.
>
> Prefix note: named `shared-` because it must land across `apps/web` + `apps/server` + `packages/db-schema` to function; the foundational sibling `system-per-space-db` is `system-`. Decomposes into per-app follow-ups (see Impact) — confirm the exact split at build time.

## Why

The locked pricing model ([Features §3](../../../shared/Baseout_Features.md); [`research/pricing/pricing-guide.md`](../../../research/pricing/pricing-guide.md) §3) sells **database isolation class** as a core tier gate:

| Tier | Database isolation class |
|---|---|
| Lite | SQLite (D1) |
| Core | D1 **or** dedicated Postgres in a **shared cluster** |
| Plus | dedicated Postgres in a **dedicated cluster** (the whole cluster serves one account) |
| Max | dedicated cluster **or** BYODB (any reachable Postgres) |
| Enterprise | custom (incl. private-network / on-prem BYODB) |

`system-per-space-db` already establishes *a dedicated database per Space* with three backends (`d1 | managed_pg | byodb`) and a fixed schema-agnostic model. What it does **not** capture is the pricing ladder's finer distinction and the machinery to honor it:

1. **Shared cluster vs dedicated cluster** is a topology dimension inside `managed_pg` that the current `backend` enum doesn't express. Core's "shared cluster" (multi-tenant, schema-per-Space isolation) and Plus's "dedicated cluster" (one cluster per account) are different products at different COGS.
2. **The tier gate is unenforced** — nothing maps an org's entitlement to which classes it may provision, or refuses a class above its ceiling.
3. **Provisioning/orchestration doesn't exist** — there is no code to stand up a shared cluster, lazily create a per-account dedicated cluster, or register/validate a BYODB connection string.
4. **The promotion path is deferred** — `system-per-space-db` task 6.1 (`D1 ↔ managed_pg ↔ byodb` migration) is explicitly DEFERRED. Upgrading Core→Plus must move a Space's DB up the ladder; that job has no home.
5. **Org-wide DB-size caps** (Lite 5 / Core 10 / Plus 25 / Max 50 GB) need a size measurement that works uniformly across every class.

Without this change the pricing page promises isolation guarantees the platform can't deliver — Plus/Max customers would silently sit on the same infrastructure as Lite. This change makes the ladder real.

## What Changes

Runtime code across web + server + db-schema + infra. Large; phased.

### 1. Model: an isolation-class dimension + a cluster registry
- `space_databases` gains an **`isolation_class`** (`d1 | shared_cluster | dedicated_cluster | byodb`) and a nullable **`cluster_id`** FK. `isolation_class` is the tier-facing concept; the existing `backend` stays the engine/dialect (`d1`→SQLite; `shared_cluster`/`dedicated_cluster`→managed Postgres; `byodb`→customer Postgres).
- New **`db_clusters`** master table: cluster identity, kind (`shared` multi-tenant vs `dedicated` single-account), owning org (null for shared), Hyperdrive/connection config reference, lifecycle status. `packages/db-schema` (canonical migration in `apps/web`).

### 2. The tier gate
- The allowed classes for an org derive from the `database_isolation_class` enum feature in `plan_features`, resolved via `resolveEntitlements(orgId)` (rank-ordered `d1 < shared_cluster < dedicated_cluster < byodb`). Provisioning refuses a class above the org's ceiling.
- **Downgrade is non-destructive**: an existing higher-class Space DB keeps running after a downgrade; only *new* Space provisioning is capped at the new ceiling (matches the "existing data never deleted on overage" principle).

### 3. Provisioning orchestration
- **Shared cluster**: a long-lived multi-tenant managed-PG cluster per env, provisioned once; new Core Spaces that opt into managed PG land here with schema-per-Space isolation. Lean ($15-class) baseline that scales with use (pricing pre-launch req #2).
- **Dedicated cluster**: provisioned **lazily** on an account's first Plus+ managed-PG Space; the whole cluster serves that one account; registered in `db_clusters` with the org as owner.
- **BYODB**: register + validate a customer Postgres connection string (reachability check), store it encrypted; approved vendors at launch (Supabase, Neon, DigitalOcean) plus any-Postgres-via-connection-string on a your-DB-your-ops basis.

### 4. Promotion job (owns `system-per-space-db` §6.1)
- On tier upgrade (or explicit request), promote a Space's DB up the ladder (`D1 → shared_cluster → dedicated_cluster → byodb`). Because the `bo_at_*` schema is fixed across backends, promotion is a **data copy + cutover**, not a reshape. Async, resumable, verified, minimal-downtime cutover; the engine read broker switches the Space to the new DB atomically.

### 5. Org-wide DB-size measurement
- Ensure per-Space size measurement works across every class (`pg_database_size()` for PG classes; Cloudflare REST `file_size` for D1 — the source `shared-entitlements` task 3.2 consumes). Org total = sum across the org's Space DBs. **Enforcement of the cap lives in `shared-entitlements`** (background meter); this change guarantees the measurement source exists per class.

### 6. Security review points (new infra surface)
- BYODB connection strings encrypted at rest (AES-256-GCM, master key; PRD §20.2), least-privilege DB roles, validated before use, never logged.
- Dedicated clusters are network-isolated per account; shared cluster relies on schema-level isolation (documented boundary).
- New provisioning routes are staff/system-gated; no customer-facing raw cluster control beyond the BYODB connection-string entry (validated + encrypted).

## Impact

- **Multi-app (`shared-`), decomposes into follow-ups once the model lands:**
  - `packages/db-schema` — `space_databases` deltas + `db_clusters` table (canonical migration in `apps/web`; server/admin mirrors).
  - `apps/server` — provisioning + BYODB registration + the promotion job + per-class read/write routing (extends the existing broker); size measurement across classes.
  - `apps/web` — isolation-class resolution via `resolveEntitlements`; provisioning triggers on upgrade; BYODB connection-string entry UI (settings); no direct per-Space DB connection (unchanged from `system-per-space-db`).
  - **Infra** — shared-cluster baseline per env + per-account dedicated-cluster lifecycle + Hyperdrive configs (mind the shared-dev Hyperdrive ~19-conn ceiling — do not add pools that saturate it).
- **Gated by** `shared-entitlements` (needs the `database_isolation_class` enum feature + resolution lib); **paired conceptually** with `system-r2-bucket-topology` (the file-storage half of the storage/DB restructure).

## Out of Scope

| Deferred to | Item |
|---|---|
| `shared-entitlements` | The `database_size` **cap enforcement** (background meter). This change provides the measurement source only. |
| `system-per-space-db` | The per-Space `bo_at_*` data model, control/data-plane split, and engine read broker (already owned there). |
| Enterprise contract work | Private-network / on-prem BYODB and bespoke cluster arrangements (Enterprise custom, via `admin-entitlements` contracts). |
| Future change | Cross-region residency placement and automated cluster right-sizing/autoscaling beyond the lean baseline. |
