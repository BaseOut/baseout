## Why

Today a Space has a **single** backup `frequency` and a single `mode`; every scheduled run captures schema and (in dynamic mode) all records together. That couples the cheap, fast **schema** capture — which powers the Schema page (Browse / Visualize / Changelog / Health) — to the expensive full **data** backup. Customers can't keep their Schema view fresh (e.g. daily) without paying the cost (time, storage, credits) of a full data backup at the same cadence, and can't adopt Baseout for schema intelligence alone without committing to full data backups.

## What Changes

- Split the single backup schedule into **two independent schedules** per Space: a **schema** schedule and a **data** schedule.
- Introduce two **run kinds**: `schema` (captures schema only) and `data` (captures schema **and** records). A `data` run always captures schema first, so data is never stored without a matching schema snapshot.
- Define **backup scope** per Space: **Schema Only** (a schema schedule, no data schedule) or **Schema + Data** (a data schedule, optionally with a *more frequent* schema schedule — e.g. data monthly, schema daily).
- **BREAKING** — `backup_configurations`: replace the single `frequency` / `next_scheduled_at` with `schema_frequency` + `data_frequency` (data nullable; `null` = Schema Only) and `schema_next_scheduled_at` + `data_next_scheduled_at`. Existing rows migrate.
- `backup_runs` (master) and `bo_at_base_runs` (per-Space) gain a `kind` (`schema` | `data`) so runs and history distinguish schema-only from full backups.
- The per-Space **SpaceDO** multiplexes both schedules onto its single alarm: on fire it runs the due kind(s); a `data` run subsumes a concurrently-due `schema` run; the next alarm is recomputed as the earliest of the two next-fires.
- The engine's **capture path branches on run kind**: a `schema` run writes only the per-Space schema tables / versions / diffs; a `data` run also captures records and the full per-run CSV snapshot.
- **Tiering**: Schema Only is available broadly (lets a customer use the Schema page before/without full data backup); a separate or higher-frequency schema schedule, and higher data cadences, gate by tier.

## Capabilities

### New Capabilities
- `split-backup-schedules`: independent schema vs data backup schedules, typed runs (schema-only / schema+data), and the configuration + scheduler + capture-path model that supports them.

### Modified Capabilities
<!-- The capabilities this refines (backup-scheduling, backup-dynamic-mode, per-space-db) live in
     not-yet-archived changes (server-schedule-and-cancel, server-dynamic-mode, system-per-space-db),
     so their requirement changes are captured in this change's spec + design rather than as delta
     specs against openspec/specs/. See design.md → "Supersedes / reconciles". -->

## Impact

- **Master DB**: `backup_configurations` — additive columns + a migration of `frequency` → `data_frequency` / `schema_frequency`; `backup_runs.kind`.
- **Per-Space DB**: `bo_at_base_runs.kind` (additive to `system-per-space-db`).
- **apps/server**: SpaceDO dual-schedule alarm multiplexing; per-schedule `computeNextFire`; capture branch by run kind; `POST /set-frequency` → `POST /set-schedules`.
- **apps/web**: `PATCH /api/spaces/:id/backup-config` accepts two schedules + scope; master-schema migration; reads two next-run timestamps for display.
- **apps/workflows**: `backup-base` task branches schema-only vs schema+data capture — **paired change `workflows-split-backup-schedules`** (per CLAUDE.md §3.6).
- **UI**: a separate change lands in `ui-only/openspec` (`backup-schedule-and-scope`) for choosing scope and configuring the two schedules.
- **Cross-references**: `server-schedule-and-cancel` (single-frequency model this extends), `server-dynamic-mode` (`mode`/`records_enabled` scope), `system-per-space-db` (`bo_at_base_runs`, schema capture), `server-retention-and-cleanup` (schema vs data runs may retain differently).
</content>
