> **Status (as of the backend slice).** Shipped on `autumn/design-to-web`:
> `2545a05` (§1 schema + master deltas), `9082461` (§2 managed_pg provisioning),
> `52cb13b` (§3a pure diff modules), `22b4dd3` (§3b engine write path),
> `aff0bd8` (§3c writer wiring). **Not yet validated live** — the deployed smoke
> (deploy dev engine + `trigger.dev dev` → run a backup → `bo_at_*` populate) is
> the outstanding gate. Backend-first = `managed_pg`; d1/byodb, the read path
> (§4), restore (§5), and migration/prune (§6.1/§6.3) are deferred as planned.

## 1. Schema authoring

- [x] 1.1 Author the per-Space DB schema, Postgres dialect, in `packages/db-schema/src/space/pg.ts` (from `schema/pg.ts` reference here). All `bo_at_*` tables.
- [x] 1.2 Author the SQLite/D1 mirror in `packages/db-schema/src/space/sqlite.ts` (from `schema/sqlite.ts`). Keep in lockstep with pg.ts (a test asserts table/column parity).
- [x] 1.3 Barrel + a `space-schema-version` constant for the lazy on-DB migration check (PRAGMA user_version on D1 / a `bo_at_meta` row on PG). _(Constant `SPACE_SCHEMA_VERSION` shipped; the on-DB version row / PRAGMA mechanism is part of the deferred lazy-migration in §2.2.)_
- [~] 1.4 Master DB deltas: refactor `space_databases` (`tier` → `backend` + `records_enabled`, generic `pg_locator`, migration-state columns); add `health_score_rules`; remove `attachment_dedup`; slim `at_bases` to identity; drop planned `backup_run_bases`; remove schema-change rows from `audit_history` scope. _(DONE: `space_databases` + `health_score_rules` created (migration 0017, applied). DEFERRED: `attachment_dedup` removal → §3.4 cutover; `at_bases` slim → standalone follow-up (destructive, breaks rediscovery write path). N/A: `backup_run_bases` never existed; `audit_history` not in this repo.)_
- [x] 1.5 drizzle-kit generate for the master deltas; the per-Space schema gets its own drizzle config (separate `out`) per PRD §21.1. _(Two per-Space configs: `drizzle.space-{pg,sqlite}.config.ts` → `migrations/space-{pg,sqlite}`.)_

## 2. Provisioning

- [~] 2.1 Provision a dedicated per-Space DB at Space creation per `backend`. _(DONE: `managed_pg` — schema-per-Space on the shared cluster, `pg_locator`; engine route `/provision-database`, wired into `POST /api/spaces`. DEFERRED: `d1` (needs a Cloudflare API token) + `byodb` → currently `backend_not_implemented`. Onboarding first-space path not yet wired.)_
- [~] 2.2 Apply the per-Space schema to the new DB (dialect by backend). Lazy versioned migration on access. _(DONE: managed_pg applies the bundled `bo_at_*` DDL. DEFERRED: lazy versioned on-access migration.)_
- [x] 2.3 Enforce posture: reject `sovereign` (byodb) unless `records_enabled`. _(DB CHECK `space_databases_sovereign_requires_records` + app-level `validateProvisionRequest`.)_

## 3. Capture / writer (engine + workflows) — Option B: engine-brokered writes

- [x] 3.1 Per run, hash the captured base schema; write/lookup `bo_at_schema_versions` (insert only on hash change); set `bo_at_base_runs.schema_version_id` + `schema_hash`.
- [x] 3.2 Diff captured schema vs current `bo_at_bases/tables/fields/views`: insert/seen, `removed` only on a confident full enumeration else `unknown`; bump `last_seen_run`; modifications → `bo_at_schema_updates` (before+after, `breaks_data`).
- [x] 3.3 Records (when `records_enabled`): upsert `bo_at_records` + `bo_at_record_field_data` (sparse-until-first-value); append `bo_at_record_updates` superseded old value; first population logs nothing.
- [ ] 3.4 Attachments → `bo_at_attachments` (per-Space dedup). _(DEFERRED: attachments still dedup via master `attachment_dedup`; cutover + dropping the master table is a standalone follow-up. Also captures views/options/field-descriptions, which need the `airtable-client` schema type extended.)_
- [x] 3.5 Always write the per-run CSV snapshot(s) to the file destination. _(Pre-existing static-backup path, retained.)_
- [x] 3.6 Engine rolls up overall status to master `backup_runs` independently of the per-Space DB. _(Pre-existing `/runs/:id/complete`, retained.)_

## 4. Read path — DEFERRED (UI-gated; Schema/data-intelligence UI are placeholders)

- [ ] 4.1 Engine internal read endpoints for the Schema page (broker per-Space reads).
- [ ] 4.2 Generate per-table query views over `bo_at_record_field_data`.
- [ ] 4.3 SQL REST API queries the generated views read-only (reconcile with `sql`).

## 5. Restore — DEFERRED

- [ ] 5.1 Restore reads per-run CSV snapshots; per-run granularity; decoupled from `bo_at_record_updates`.

## 6. Migration + lifecycle ops

- [ ] 6.1 Backend migration job (D1↔managed_pg↔byodb) — DEFERRED.
- [~] 6.2 Cleanup fan-out: on Space/run deletion, tear down the per-Space rows/DB. _(`dropManagedPgSchema` helper shipped; NOT yet wired to a Space-deletion path.)_
- [ ] 6.3 Prune `bo_at_record_updates` by retention — DEFERRED (ship after the core model).

## 7. Reconcile superseded specs — DONE

- [x] 7.1 `server-dynamic-mode` superseded banner (tier→backend×records; per-table→EAV+views; `bo_at_*`; per-base→`bo_at_base_runs`).
- [x] 7.2 `workflows-dynamic-mode` banner (diffs → `bo_at_schema_updates`, not master `audit_history`).
- [x] 7.3 `server/schema-diff` banner (realize `schema_diffs`/`health_scores` as concrete `bo_at_*`; rules stay master).
- [x] 7.4 `server-attachments` banner (`attachment_dedup` → `bo_at_attachments`).

## 8. Confirm the applied defaults (flagged in design.md) — proceeded on recommended defaults

- [x] 8.1 `bo_at_documentation` shape (single description + source + don't-clobber); Data Dictionary = V2.
- [x] 8.2 `bo_at_views` included.
- [x] 8.3 Health: scores append / issues replace.
- [x] 8.4 `managed_pg` = schema-per-Space (vs db-per-Space).
