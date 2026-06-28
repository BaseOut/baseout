## Why

The engine change `server-split-backup-schedules` introduces two run kinds — `schema` and `data` — dispatched on **independent schedules** (e.g. schema daily, data monthly). The Trigger.dev `backup-base` task today runs a single flow (schema + records together). It must become **kind-aware**: run a schema-only capture for `schema` runs and the full schema+records capture for `data` runs, and tolerate schema and data runs being scheduled and executed independently.

## What Changes

- The `backup-base` task payload gains **`kind`** (`schema` | `data`).
- Extract a reusable **schema-capture step**; both kinds run it — a `data` run runs it **first**, then records.
- `kind = schema`: capture schema only — upsert the per-Space schema tables, lifecycle, `bo_at_schema_versions` / `bo_at_schema_updates`; **skip** record fetch and the per-run data CSV; tag `bo_at_base_runs.kind = 'schema'`.
- `kind = data`: run the schema step, then records (CSV to the file destination + dynamic-DB upserts) + the per-run CSV snapshot; tag `kind = 'data'`.
- Progress / completion **engine-callbacks carry `kind`**; a `schema` run reports schema metrics (tables/fields), not record counts.
- **Concurrency**: schema and data runs may overlap (separate schedules). The task relies on the per-Connection lock (ConnectionDO) for serialization and on **idempotent** schema upserts (hash-deduped `bo_at_schema_versions`) so an overlapping or redundant schema capture is harmless. The task assumes no exclusivity.

## Capabilities

### New Capabilities
- `split-backup-task`: the kind-aware `backup-base` Trigger.dev task — branching schema-only vs schema+data, the shared schema-capture step, and `kind` in the engine-callback contract.

### Modified Capabilities
<!-- Refines the backup-base behavior specified in the unarchived workflows-dynamic-mode change.
     Captured here + in design rather than as a delta spec against openspec/specs/. -->

## Impact

- **apps/workflows**: `backup-base.ts` (pure orchestration) branches on `kind`; a shared schema-capture helper; `backup-base.task.ts` payload gains `kind`; tests per kind.
- **Contract**: task payload `kind` and the progress/complete callback `kind`.
- **Pairs with** baseout `server-split-backup-schedules` (the engine computes the two schedules and dispatches the task with a `kind`).
- **Builds on** `workflows-dynamic-mode` (the records flow) and `system-per-space-db` (the `bo_at_*` schema/records tables and hash-deduped schema versions).
</content>
