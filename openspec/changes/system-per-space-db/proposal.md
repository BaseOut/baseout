# system-per-space-db

## Why

Baseout captures Airtable schema, records, attachments, and change history for every Space. Today that storage is spread across the master DB (mirrors, `attachment_dedup`, `audit_history` schema rows) and a tier-shaped "client DB" whose model (`server-dynamic-mode`) bundles backend choice and record-storage into one `tier` enum and stores records as one physical table per Airtable table.

A design review (2026-06-20) reworked this into a cleaner, governance-aware model and resolved several open questions. This change is the authoritative record of that model and **supersedes the conflicting parts of `server-dynamic-mode`, `workflows-dynamic-mode`, and the `schema-diff` capability** (see `design.md` → Supersedes).

The core ideas:

1. **A dedicated database per Space**, always — one of three backends: Cloudflare **D1** (SQLite), Baseout-**managed Postgres**, or customer **BYODB** (Postgres).
2. **A clean control-plane / data-plane split**: the master DB holds *our operational state*; the per-Space DB holds *everything derived from Airtable*.
3. **Data residency as a posture** — `managed` vs `sovereign` (BYODB) — so governance-strict customers can keep schema *and* data entirely off Baseout infrastructure.
4. **A generic, schema-agnostic storage model** (bases/tables/fields/records/record_field_data) instead of one physical table per Airtable table, with ergonomic per-table **views** generated on top. No runtime `ALTER TABLE`, one fixed schema across all backends, trivial backend migration.
5. **Diff/history as lifecycle state + append-only update logs**, not full re-snapshots — sized for D1's storage limits.

## What changes

- **New per-Space DB schema** (`bo_at_*` tables), authored dual-dialect (Postgres + SQLite/D1). Reference Drizzle definitions in `schema/pg.ts` and `schema/sqlite.ts`.
- **Master DB deltas**: `space_databases` refactored (`tier` → `backend` × `records_enabled`); new `health_score_rules`; `attachment_dedup` removed (moves to per-Space `bo_at_attachments`); `at_bases` slimmed to identity; planned `backup_run_bases` dropped (moves to per-Space `bo_at_base_runs`); schema rows leave `audit_history`.
- **Read path**: `web` never connects to per-Space DBs; the engine brokers all reads (uniform across D1/PG/BYODB). The SQL REST API is the one separate customer-facing broker.
- **Restore** reads per-run CSV snapshots from the file destination (already mandated), decoupled from the prunable record-change log.

## Impact

- Affected specs: **supersedes** parts of `server-dynamic-mode`, `workflows-dynamic-mode`, `server/schema-diff`; **touches** `web/schema-ui`, `web/data-intelligence-ui`, `sql`, `server-attachments`, `server-restore`.
- Affected code (follow-up): `packages/db-schema` (new per-Space schema module + core deltas), `apps/server` (writer + read broker + provisioning + migration job), `apps/web` (reads via engine), `apps/workflows` (backup task writes per-Space DB), `apps/sql` (queries generated views).
- This is a foundational data-model change; it lands before the dynamic-mode / schema-diff / data-intelligence build phases.
</content>
