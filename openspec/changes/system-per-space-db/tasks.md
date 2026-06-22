## 1. Schema authoring

- [ ] 1.1 Author the per-Space DB schema, Postgres dialect, in `packages/db-schema/src/space/pg.ts` (from `schema/pg.ts` reference here). All `bo_at_*` tables.
- [ ] 1.2 Author the SQLite/D1 mirror in `packages/db-schema/src/space/sqlite.ts` (from `schema/sqlite.ts`). Keep in lockstep with pg.ts (a test asserts table/column parity).
- [x] 1.3 `bo_at_meta` single-row table (schema_version + self-describing space_id/backend/platform) authored in pg.ts/sqlite.ts. Still TODO: a `SPACE_SCHEMA_VERSION` code constant + the lazy on-access migration runner that compares them.
- [ ] 1.4 Master DB deltas: refactor `space_databases` (`tier` → `backend` + `records_enabled`, generic `pg_locator`, migration-state columns); add `health_score_rules`; remove `attachment_dedup`; slim `at_bases` to identity (`base_id`, `space_id`, `name`, `is_selected`); drop planned `backup_run_bases`; remove schema-change rows from `audit_history` scope.
- [ ] 1.5 drizzle-kit generate for the master deltas; the per-Space schema gets its own drizzle config (separate `out`) per PRD §21.1 ("separate configs per env: master DB, client DBs").

## 2. Provisioning

- [ ] 2.1 Provision a dedicated per-Space DB at Space creation per `backend`: create a D1 database (store `d1_database_id`), or a Postgres schema-per-Space on the managed cluster (store `pg_locator`), or validate a BYODB connection string (encrypt → `byodb_connection_string_enc`).
- [ ] 2.2 Apply the per-Space schema to the new DB (dialect by backend). Lazy versioned migration on access (check `space-schema-version`; run pending migrations).
- [ ] 2.3 Enforce posture: reject `sovereign` (byodb) unless `records_enabled` (sovereign requires a dynamic DB).

## 3. Capture / writer (engine + workflows)

- [ ] 3.1 Per run, hash the captured base schema; write/lookup `bo_at_schema_versions` (insert only on hash change); set `bo_at_base_runs.schema_version_id` + `schema_hash`.
- [ ] 3.2 Diff captured schema vs current `bo_at_bases/tables/fields/views`: insert new (status=active, first_seen_run), mark confidently-absent removed (first_unseen_run) — `unknown` on partial/failed enumeration, never false-delete; bump `last_seen_run`; write modifications to `bo_at_schema_updates` (before+after, `breaks_data`).
- [ ] 3.3 Records (when `records_enabled`): upsert `bo_at_records` (lifecycle) + `bo_at_record_field_data` (sparse-until-first-value, single JSON value). On value change, append `bo_at_record_updates` with the superseded old value; first population logs nothing.
- [ ] 3.4 Attachments → `bo_at_attachments` (per-Space dedup by composite_id / content_hash); binaries stream to the file destination.
- [ ] 3.5 Always write the per-run CSV snapshot(s) to the file destination (chunk large tables) — the Restore backbone.
- [ ] 3.6 Engine rolls up overall status to master `backup_runs` independently of the per-Space DB (survives a sovereign-DB outage).

## 4. Read path

- [ ] 4.1 Engine internal read endpoints for the Schema page (schema, changelog from lifecycle+`schema_updates`, health) — broker per-Space DB reads; `web` never connects directly.
- [ ] 4.2 Generate per-table query views over `bo_at_record_field_data` (pivot, safe-cast by current field type): D1 = live views; managed/BYODB Postgres = materialized views refreshed per run.
- [ ] 4.3 SQL REST API queries the generated views under a read-only role (reconcile with `sql` change).

## 5. Restore

- [ ] 5.1 Restore reads per-run CSV snapshots from the file destination; granularity = per run (user picks from run history). Decoupled from `bo_at_record_updates`.

## 6. Migration + lifecycle ops

- [ ] 6.1 Backend migration job (D1↔managed_pg↔byodb): row-copy of all `bo_at_*` tables; 7-day grace before decommissioning the old DB; downgrade may require disabling records (capacity).
- [ ] 6.2 Cleanup fan-out: on Space/run deletion, the cleanup job tears down the matching per-Space rows (no cross-DB cascades).
- [ ] 6.3 Prune `bo_at_record_updates` by retention (simple DELETE; timeline framing) — additive, tier-based; ship after the core model.

## 7. Reconcile superseded specs

- [ ] 7.1 Update `server-dynamic-mode` (tier→backend×records; per-table→generic EAV+views; `bo_at_*` naming; per-base run state→`bo_at_base_runs`).
- [ ] 7.2 Update `workflows-dynamic-mode` (schema diffs → `bo_at_schema_updates`, not master `audit_history`).
- [ ] 7.3 Update `server/schema-diff` (realize `schema_diffs`/`health_scores` as concrete `bo_at_*`; rules stay master).
- [ ] 7.4 Update `server-attachments` (`attachment_dedup` → `bo_at_attachments`).

## 8. Open-item decisions

Resolved 2026-06-22:
- [x] 8.1 Documentation = inline `ai_description` / `ai_overview` / `description_override` columns on bases/tables/fields/records (imported stays as `description`); no `bo_at_documentation` table. Data Dictionary = V2.
- [x] 8.2 `bo_at_views` included, capture gated to Airtable Enterprise customers.
- [x] 8.4 `managed_pg` = schema-per-Space (multiple Spaces' schemas per database).

Still open:
- [ ] 8.3 Health tables + rule taxonomy — deferred; current draft stands (scores append / issues replace; rules in core `health_score_rules`).
</content>
