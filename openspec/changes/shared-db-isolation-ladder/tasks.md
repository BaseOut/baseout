# shared-db-isolation-ladder — tasks

TDD per CLAUDE.md §3.4. Provisioning/promotion are pure-orchestration modules with injected deps (like the workflows task pattern) so the decision logic is unit-testable; live cluster/BYODB interactions verified in integration against a local Postgres. Depends on `system-per-space-db` (per-Space model + broker) and `shared-entitlements` phases 1–2 (the `database_isolation_class` enum feature + resolution lib).

## 1. Model

- [ ] 1.1 `space_databases` gains `isolation_class` (`d1 | shared_cluster | dedicated_cluster | byodb`) + nullable `cluster_id`; derive/backfill `isolation_class` from existing `backend`; `packages/db-schema` + canonical migration in `apps/web`; server/admin mirrors header-commented; `db:check` clean
- [ ] 1.2 New `db_clusters` master table (kind, owner_org_id, connection/Hyperdrive config ref, status); migration + mirrors; tests for the row lifecycle helpers

## 2. Tier gate

- [ ] 2.1 Pure `allowedIsolationClasses(entitlements)` + `refuseAboveCeiling(requested, entitlement)` using the resolution lib's `database_isolation_class` rank; exhaustive Vitest (each tier → allowed set; above-ceiling refusal)
- [ ] 2.2 Wire the gate into every provisioning entry point; downgrade leaves existing DBs running, caps only new provisioning; tests

## 3. Provisioning

- [ ] 3.1 Shared-cluster bootstrap (per env, ops/idempotent) + register in `db_clusters`; Core managed-PG Spaces provision a schema-isolated DB on it; integration test vs local PG
- [ ] 3.2 Dedicated-cluster lazy provisioning on first Plus+ managed-PG Space: idempotent, concurrency-safe, org-owned `db_clusters` row; tests for the race
- [ ] 3.3 BYODB registration: reachability + version validation, apply `bo_at_*` DDL via the idempotent path, encrypted connection-string storage (AES-256-GCM); tests incl. unreachable/old-version/at-cap failures
- [ ] 3.4 Mind the shared dev Hyperdrive ceiling — pool sizing that does not saturate the ~19-conn dev cluster; documented

## 4. Promotion job (owns system-per-space-db §6.1)

- [ ] 4.1 Pure promotion planner: source/target class, per-table copy plan, checkpoint model; Vitest on the plan/resume logic
- [ ] 4.2 Copy + verify (row counts/checksums) across the fixed `bo_at_*` schema; resumable; integration test D1→managed-PG and managed-PG→managed-PG
- [ ] 4.3 Atomic cutover: flip the Space's `space_databases` pointer so the engine broker reads the new DB; gate on the SpaceDO scheduler (never mid-backup); drain/retire the old DB after a safety window; tests
- [ ] 4.4 Trigger promotion on tier upgrade (or explicit staff/customer request); audited; tests

## 5. Size measurement across classes

- [ ] 5.1 Per-Space size measurement uniform across classes (`pg_database_size()` for PG; Cloudflare REST `file_size` for D1) exposed as the source `shared-entitlements` task 3.2 consumes; org-total summation; tests. (Cap **enforcement** stays in `shared-entitlements`.)

## 6. Security + verification

- [ ] 6.1 Security review points documented: BYODB cred encryption/least-privilege/no-logging, dedicated-vs-shared isolation boundary, provisioning route gating (`INTERNAL_TOKEN`/staff)
- [ ] 6.2 End-to-end smoke (Verification demo): Core org → provision a shared-cluster Space DB; upgrade to Plus → promotion moves it to a lazily-created dedicated cluster; Max org → register a BYODB connection string and back up into it; org-wide DB size reports across all three
- [ ] 6.3 Typecheck, build, `db:check`, and db-schema/server suites green; Hyperdrive conn-count sanity checked against the dev ceiling
