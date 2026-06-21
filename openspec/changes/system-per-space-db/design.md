## Context

Every Space captures Airtable schema + (optionally) records + attachments, tracks how they change over time, and must support Restore. This must run on Cloudflare D1 *and* Postgres *and* customer-owned Postgres (BYODB), with cheap migration between them, and must satisfy data-residency / governance requirements for customers who cannot let their data (or even their schema/field-names) reside on Baseout infrastructure.

Stakeholders: `server` (writes the per-Space DB + brokers reads + provisions/migrates), `workflows` (backup task writes schema/records), `web` (reads via engine), `sql` (queries generated views), `packages/db-schema` (owns the schema definitions).

## Goals / Non-Goals

**Goals**
- One dedicated database per Space; backend pluggable (D1 / managed PG / BYODB) without changing the table model.
- Clean control-plane (master DB) vs data-plane (per-Space DB) split, so a sovereign customer's schema + data live *only* in their DB.
- Schema-agnostic storage (no runtime `ALTER TABLE`, one fixed schema across backends, row-copy migration).
- Change history sized for D1 storage limits (lifecycle state + append-only update logs + prunable cell log).
- Point-in-time Restore from immutable per-run snapshots, decoupled from prunable history.

**Non-Goals**
- Multi-platform Spaces (a Space is one platform; V2).
- Sub-run-granularity Restore ("restore to Tuesday 3pm between runs") — V2.
- Standalone Data Dictionary surface + export — V2 (V1 = descriptions only).
- "Mirrored" posture (managed + customer copy) — deferred; not V1.
- Write-back of descriptions to Airtable — V2 ("management actions").

## Decisions

1. **Dedicated DB per Space.** Replaces the shared/row-prefixed D1 of the old design. Backend ∈ {`d1`, `managed_pg`, `byodb`}; record storage is a separate boolean. So `space_databases.tier` (5-value enum) → `backend` × `records_enabled`. The per-Space DB always exists (schema/attachments/diffs/docs); "dynamic" only toggles record-table population.

2. **Control-plane vs data-plane.** Master DB = our operational state (orgs, spaces, connections, subscriptions, credits, `backup_configurations`, overall `backup_runs`, schedules, `storage_destinations`, `space_databases`, `health_score_rules`, `static_snapshots` with opaque keys, `airtable_webhooks`). Per-Space DB = everything Airtable-derived (`bo_at_*`). Per-base run *execution* detail (status/step/schema-version) lives per-Space (`bo_at_base_runs`); the *overall* run + rolled-up status lives in core `backup_runs` and is updated by the engine independently (survives a sovereign-DB outage).

3. **Residency posture.** `managed` (d1/managed_pg) vs `sovereign` (byodb = nothing sensitive on our infra). **Sovereign requires a dynamic DB.** D1 *is* encrypted at rest (as is managed PG); the governance distinction is "who can decrypt/query," not encryption.

4. **Cross-DB links are plain UUID columns**, never FKs (no cross-DB cascades). App-level integrity; the cleanup job fans out to per-Space teardown on Space/run deletion.

5. **Engine brokers all per-Space reads.** `web` never connects to a per-Space DB — uniform read path across D1/PG/BYODB and invisible-to-UI posture. The SQL REST API is the one separate customer-facing broker (read-only role on the Space DB, querying the generated views).

6. **Naming: `bo_at_` prefix** on all per-Space canonical tables (`bo_` = Baseout-owned, important inside a customer's BYODB; `at_` = Airtable platform namespace; future Notion = `bo_no_`). Generated per-table query views use clean raw Airtable names (`deals`). Master tables keep no prefix.

7. **Generic storage model, not one-table-per-Airtable-table.** Reverses `server-dynamic-mode` B1 (per-table + JSONB). Records live in `bo_at_records` + `bo_at_record_field_data` (EAV). Ergonomic per-table **views** are generated on top: D1 = live pivot views; Postgres = materialized views refreshed per run (so SQL-API filters hit native typed columns). The base table holds a single JSON-encoded `value`; the view safe-casts to native type using the current type from `bo_at_fields`. Benefits: no runtime DDL, one fixed schema both dialects, row-copy migration.

8. **Schema history = lifecycle + version + update log** (not full re-snapshots):
   - Lifecycle columns on bases/tables/fields/views/records: `status` (`active`|`removed`|`unknown`), `first_seen_run`, `first_unseen_run`, `last_seen_run` (run UUIDs; timestamps derived from `bo_at_base_runs`). `removed` only on a *confident* full parent enumeration; failed/partial → `unknown` (never false-delete).
   - `bo_at_schema_versions`: immutable full base schema JSON, **hash-deduped** (new row only when `schema_hash` changes). Kept for reference / point-in-time render; the hash also gates "did anything change this run."
   - `bo_at_schema_updates`: modifications only (add/remove are lifecycle). Stores **before + after** (low volume, never pruned, self-contained changelog rows). Carries `breaks_data`.

9. **Record cell model.** `bo_at_record_field_data` is sparse-until-first-value (row created on first population, persists after, `value`→null on clear; no row = never populated). Single JSON-encoded `value`. Record-level lifecycle on `bo_at_records` (a record can have zero cell rows).

10. **Record change history = superseded-value log** (`bo_at_record_updates`): logs the *old* value being replaced + run; the new value lives only in `bo_at_record_field_data`. No duplication, no init rows (rfd row exists → log old + update; doesn't exist → first population, log nothing). High-volume + **prunable via simple DELETE + timeline framing** (earliest retained = earliest known; pre-window is genuinely gone). Field-type-change correlation derived by joining `(run_id, field_id)` to `bo_at_schema_updates` — no redundant type storage. Time lives on the run.

11. **Restore reads per-run CSV snapshots** in the file destination (every run writes them — "dynamic alongside static"). Per-run point-in-time granularity (user picks from run history). Decoupled from the prunable record log. No shadow R2 copy (would violate BYOS no-disk + sovereign governance); a managed safety copy = adding R2-managed as an additional file destination. Large tables chunk into multi-part CSVs.

## Open items — resolved with recommended defaults (confirm)

These were not finalized in the design session; this change applies the recommended default and flags each:

- **`bo_at_documentation`**: single `description` per target + `source` tag (`imported`|`ai`|`manual`) + don't-clobber-manual-on-reimport; keyed by Airtable id. Auto-derived structural facts ("referenced by N lookups") computed on read, not stored. Data Dictionary surface/export = **V2**.
- **`bo_at_views`**: **included** (cheap, part of Airtable schema). Drop if not needed by Visualize/Health.
- **Health**: `bo_at_health_scores` appended per run (trend); `bo_at_health_issues` replaced per run (only current actionable). Rules in core `health_score_rules`.
- **`managed_pg`**: **schema-per-Space** on a shared cluster (cheaper at scale) rather than a separate PG database per Space. `space_databases` stores a generic locator.

## Supersedes / reconciles

- **`server-dynamic-mode`**: replaces the `space_databases.tier` enum (→ `backend` × `records_enabled`); reverses B1 (per-table → generic EAV + generated views); renames client-DB tables to `bo_at_*`; per-base run state moves to `bo_at_base_runs`.
- **`workflows-dynamic-mode`**: schema diffs no longer POST to master `audit_history`; they become `bo_at_schema_updates` (+ lifecycle) in the per-Space DB.
- **`server/schema-diff`**: "schema_diffs in client DB" / "health_scores in client DB" are realized as the concrete `bo_at_*` tables here; `health_score_rules` stays in master.
- **`server-attachments`**: `attachment_dedup` (master) → `bo_at_attachments` (per-Space, renamed).

## Risks / Trade-offs

- **[Trade-off] Dual-dialect schema** (SQLite + Postgres) authored/maintained twice. Cost of D1-at-the-bottom; mitigated by a fixed, small canonical schema.
- **[Trade-off] EAV pivot performance** on large tables → Postgres materialized views refreshed per run; D1 stays small (lower tiers). The perf concern lands where the capable backend (matview) exists.
- **[Risk] Safe-casting in generated views** — a retyped field can hold non-conforming old values; the view generator MUST emit safe casts (NULL on failure), else the whole view errors.
- **[Risk] False removals** from flaky runs → the `unknown` status + "removed only on confident full enumeration" rule.
- **[Risk] D1 storage ceiling** with full cell-change history → simple-delete pruning + the superseded-log (no dup, no init rows) + the dropped redundancies (timestamps, typed columns).
- **[Trade-off] App-level referential integrity** across DBs → cleanup job owns per-Space teardown; orphans possible if it fails (retried).
</content>
