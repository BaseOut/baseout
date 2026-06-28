## Context

`backup-base` (a Trigger.dev task in `apps/workflows`, pure orchestration in `backup-base.ts` + a thin `backup-base.task.ts` wrapper) is enqueued by the SpaceDO and captures a base's schema and records, reporting progress/completion to the engine via internal callbacks. With `server-split-backup-schedules`, the engine now dispatches runs of two kinds on separate schedules; the task must run the matching flow. Schema and records both land in the per-Space DB (`system-per-space-db`); record streaming + CSV come from the `workflows-dynamic-mode` / static paths.

## Goals / Non-Goals

**Goals**
- A `kind`-aware `backup-base` that runs schema-only for `schema` runs and schema+records for `data` runs.
- One shared schema-capture step, reused by both kinds (data runs it first).
- Safe behavior when a schema run and a data run overlap (independent schedules).
- `kind` carried through the engine-callback contract.

**Non-Goals**
- Computing or owning the schedules / deciding which kind to run (that's the SpaceDO in `server-split-backup-schedules`).
- Changing what schema/records contain (`system-per-space-db`).
- Per-table or per-base scheduling.

## Decisions

1. **Payload `kind`.** `backup-base.task.ts` accepts `kind: 'schema' | 'data'` (defaulting to `data` for back-compat during rollout). The pure `backup-base.ts` branches on it.

2. **Extract a shared schema-capture step.** Refactor the existing schema-capture logic into a reusable function: fetch the base schema, diff vs current, upsert `bo_at_bases/tables/fields/views` + lifecycle, write `bo_at_schema_updates`, and create/lookup the hash-deduped `bo_at_schema_versions`. Both kinds call it; a `data` run calls it first, then proceeds to records. This guarantees "a data run always captures schema first."

3. **Schema run = schema step only.** `kind = 'schema'` runs the schema step and stops: no record fetch, no dynamic-DB record upserts, no per-run data CSV. It tags `bo_at_base_runs.kind = 'schema'` and reports schema-only progress.

4. **Data run = schema step + records.** `kind = 'data'` runs the schema step, then the existing records path (CSV stream to the file destination and/or dynamic-DB upserts) and the per-run CSV snapshot, tagging `kind = 'data'`.

5. **Overlap is safe by idempotency, not locking gymnastics.** Independent schedules mean a `schema` run and a `data` run for the same base can be live near each other. The per-Connection ConnectionDO lock already serializes Airtable access per Connection. Schema writes are idempotent — upserts keyed by Airtable IDs + hash-deduped `bo_at_schema_versions` — so a redundant/overlapping schema capture converges to a no-op rather than corrupting state. The task therefore assumes **no exclusivity** and never special-cases the other kind. (The engine also subsumes coincident fires into a single `data` run, so true simultaneity for the same base is rare.)

6. **Callback contract carries `kind`.** Progress and completion callbacks include `kind`; a `schema` run's progress reports tables/fields captured (schema metrics), not record counts. The engine rolls `kind` up to `backup_runs`.

7. **Duration.** Schema runs are light/fast; data runs keep the existing `maxDuration`. No per-kind override needed initially.

## Risks / Trade-offs

- **[Risk] Overlapping schema + data on the same base double-write schema.** → Idempotent upserts + hash-dedup make the second write a no-op; the ConnectionDO lock serializes the Airtable reads. Covered by a concurrency test.
- **[Trade-off] Redundant schema run when data is mid-flight.** → A `data` run already captures schema; a coincident `schema` run is redundant but harmless. The engine subsumes coincident fires, so this is an edge, not the norm.
- **[Risk] Back-compat during rollout.** → Payloads without `kind` default to `data` (today's behavior), so an in-flight enqueue from before the rollout still runs a full backup.
- **[Trade-off] Refactor surface.** → Extracting the schema step touches the existing orchestration; mitigated by keeping the pure module the test target (one test per kind + the concurrency case).
</content>
