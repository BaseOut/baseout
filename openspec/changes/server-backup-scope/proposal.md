## Why

A Space has one backup cadence today (`backup_configurations.frequency`) and every run captures schema **and** data. Customers want to keep the Schema page fresh **between** heavier data backups — e.g. schema daily, data monthly — and some want **Schema Only** (structure + history, no record data) without committing to data backups. This is the engine/DB half of the ui-only `backup-schedule-and-scope` UI change (it names the backend `server-split-backup-schedules`; filed here as `server-backup-scope`).

## What Changes

- **`backup_configurations`** gains: `scope` (`schema_only` | `schema_and_data`), `schema_frequency` (nullable cadence for the schema schedule), and `schema_next_scheduled_at` (engine-owned, mirrors `next_scheduled_at`). The existing `frequency`/`next_scheduled_at` become the **data** schedule; `schema_*` is the optional more-frequent schema schedule.
- **`backup_runs`** gains `kind` (`full` | `schema`) so history can distinguish runs and the task knows what to capture. Manual + data-scheduled runs are `full`; schema-scheduled runs are `schema`.
- **`SpaceDO`** multiplexes **two** cadences onto its single alarm: it stores both next-fire timestamps, fires whichever schedule(s) are due (inserting a run with the right `kind`), and re-arms for the nearer of the two. Pure decision logic (`computeScheduleFires` / `dueKinds` / `nextAlarm`) is extracted and unit-tested.
- The engine **set-schedule** route (extends `set-frequency`) accepts `{ scope, dataFrequency, schemaFrequency }`, writes both `*_next_scheduled_at`, and proxies to the DO. The bootstrap script passes the new shape.
- The run-start path stamps `backup_runs.kind`; the per-base task payload carries it (consumed by the paired `workflows-schema-only-backup`).

## Capabilities

### New Capabilities
- `backup-scope`: per-Space backup scope (Schema Only vs Schema + Data) and an independent schema schedule, with `SpaceDO` dual-cadence dispatch and a per-run `kind`.

### Modified Capabilities
<!-- Extends server-schedule-and-cancel (single-cadence SpaceDO alarm). frequency/next_scheduled_at now mean the DATA schedule; schema_* is the new second schedule. -->

## Impact

- **Migration**: `apps/web/drizzle/00XX_backup_scope.sql` — additive columns on `backup_configurations` (`scope` default `schema_and_data`, `schema_frequency` null, `schema_next_scheduled_at` null) and `backup_runs.kind` default `full`. Canonical in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts); mirrored in [apps/server/src/db/schema/backup-configurations.ts](../../../apps/server/src/db/schema/backup-configurations.ts) + [backup-runs.ts](../../../apps/server/src/db/schema/backup-runs.ts).
- `apps/server/src/lib/scheduling/dual-schedule.ts` (new, pure) + tests — fires/due/next-alarm logic over two cadences, reusing `computeNextFire`.
- `apps/server/src/durable-objects/SpaceDO.ts` — dual-cadence alarm; stores both next-fires, stamps `kind`.
- `apps/server/src/pages/api/internal/spaces/[spaceId]/set-frequency.ts` → scope-aware `set-schedule` (back-compat: a lone `frequency` still works as the data cadence).
- `apps/server/scripts/bootstrap-space-do-alarms.mjs` — pass scope + both frequencies.
- The run-start path (`apps/server/src/lib/runs/start.ts`) + `enqueueBackupBase` (trigger-client) — thread `kind` into the payload.
- **Pairs with** `workflows-schema-only-backup` (task honors `kind='schema'`) and `web-backup-schedule-and-scope` (the UI).
- **Security**: no new surface — `set-schedule` stays `INTERNAL_TOKEN`-gated; additive columns only.
