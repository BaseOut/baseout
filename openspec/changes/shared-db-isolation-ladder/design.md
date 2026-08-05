# shared-db-isolation-ladder — design

## Context

`system-per-space-db` gives every Space a dedicated database over a fixed schema-agnostic model (`bo_at_*`), with the engine brokering all reads uniformly across `d1 | managed_pg | byodb`. The fixed schema is the key enabler here: moving a Space between backends is a **data copy**, never a reshape. This change layers the pricing ladder's *isolation topology*, the *tier gate*, the *provisioning*, and the *promotion job* on top of that model.

## Decisions

### L1 — `isolation_class` is the tier-facing dimension; `backend` stays the engine
Add `space_databases.isolation_class ∈ {d1, shared_cluster, dedicated_cluster, byodb}`. The existing `backend` (`d1 | managed_pg | byodb`) is derived: `d1→d1`, `shared_cluster|dedicated_cluster→managed_pg`, `byodb→byodb`. Keeping both avoids reworking the broker (which keys on `backend`/dialect) while giving pricing/gating a single field to reason about. A nullable `cluster_id` FK points at the `db_clusters` row for the two managed-PG classes (null for D1 and BYODB).

### L2 — `db_clusters` registry separates shared (multi-tenant) from dedicated (single-account)
One row per managed-PG cluster: `kind ∈ {shared, dedicated}`, `owner_org_id` (null ⇒ shared), connection/Hyperdrive config reference, `status ∈ {provisioning, active, draining, retired}`. Shared clusters are env-singletons (one active per env, more only when capacity demands); dedicated clusters are per-account. This is the durable record the provisioner and the promotion job both read.

### L3 — The gate is an enum-rank comparison against the entitlement
`resolveEntitlements(orgId)` returns `database_isolation_class` as a ranked enum (`d1 < shared_cluster < dedicated_cluster < byodb`). Provisioning computes the requested class and refuses anything ranked above the org's effective value. The resolution library owns the rank table (per `shared-entitlements` D3 — callers never string-compare). Downgrades never destroy an existing higher-class DB (L6).

### L4 — Provisioning: shared once, dedicated lazily, BYODB on registration
- **Shared cluster** — provisioned per env ahead of demand (ops/bootstrap); Core managed-PG Spaces get a fresh schema on it. Lean baseline, scales with use.
- **Dedicated cluster** — created lazily on an account's first Plus+ managed-PG Space (like the R2 bucket-per-account pattern): idempotent, concurrency-safe, recorded in `db_clusters` with the org as owner. Avoids orphan clusters for accounts that never provision one.
- **BYODB** — the customer supplies a Postgres connection string; validate reachability + minimum version (Postgres 13+), apply the `bo_at_*` schema via the existing idempotent DDL path, store the connection string encrypted (L7). Approved vendors are documentation, not a code allow-list — any reachable Postgres works.

### L5 — Promotion is a copy-and-cutover over the fixed schema (owns per-space-db §6.1)
On upgrade or explicit request, a Space's DB moves up the ladder. Because the schema is identical across backends, the job: (1) provisions/targets the destination DB, (2) applies the `bo_at_*` DDL, (3) copies rows (bases/tables/fields/records/record_field_data + history logs), (4) verifies row counts/checksums, (5) flips the Space's `space_databases` pointer atomically so the engine broker reads the new DB, (6) drains/retires the old DB after a safety window. Async, resumable (checkpoint per table), and idempotent. Never runs mid-backup for that Space (coordinate with the SpaceDO scheduler, mirroring the never-fail-mid-job rule).

### L6 — Downgrade and un-provisioning are non-destructive
A tier downgrade caps *new* Space provisioning at the new ceiling but leaves existing higher-class DBs running (consistent with "existing data never deleted on overage"). Churn deletion (separate path, coordinated with `shared-entitlements` churn lifecycle) is what tears down dedicated clusters / drops BYODB registration / removes shared-cluster schemas.

### L7 — Security: BYODB creds encrypted, clusters isolated, provisioning gated
BYODB connection strings are AES-256-GCM encrypted with the master key (PRD §20.2), decrypted only in the engine at use, never logged. DB roles least-privilege. Dedicated clusters are per-account network-isolated; the shared cluster's isolation is schema-level (an explicit, documented boundary — Core buys "dedicated database," not "dedicated cluster"). Provisioning/promotion routes are `INTERNAL_TOKEN`/staff-gated; the only customer-facing surface is the validated BYODB connection-string entry.

## Risks / edge cases

- **[Dev Hyperdrive saturation]** the shared dev Hyperdrive tops out near ~19 usable connections; a new shared cluster + per-account dedicated clusters must not each add a 15-conn pool against the same ceiling (recurring dev-hang failure mode). Size pools deliberately; reuse the shared dev Hyperdrive where possible.
- **[Promotion mid-backup]** gate on the SpaceDO scheduler; promote only at a job boundary.
- **[BYODB unreachable/at-size-cap]** validate before cutover; surface a clear error, keep the Space on its current DB.
- **[Shared-cluster noisy neighbor]** schema-level isolation only; capacity monitoring + the option to split shared clusters (L2 allows >1) is the pressure valve.
- **[Class/enum drift vs entitlement rank]** the rank table lives once in the resolution lib; this change consumes it, never re-defines it.

## Migration Plan

1. Model: `space_databases.isolation_class` + `cluster_id`, `db_clusters` table (additive; `isolation_class` backfilled from existing `backend`). Canonical migration in `apps/web`.
2. Gate: wire `database_isolation_class` from `resolveEntitlements` into the provisioning entry points (refuse-above-ceiling).
3. Shared cluster bootstrap (per env) + Core managed-PG Spaces land on it.
4. Dedicated-cluster lazy provisioning (Plus+) + BYODB registration (Max+).
5. Promotion job (owns per-space-db §6.1); enable D1→shared→dedicated→BYODB moves.
6. Size measurement across all classes verified (feeds `shared-entitlements` task 3.2).
7. Rollback: model deltas are additive; provisioning/promotion are new paths behind the gate — disabling them leaves every existing Space on its current DB untouched.
