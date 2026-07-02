## Why

`backup-base` always captures schema **and** data (pages records → CSV → storage, plus attachments). With dual schedules (`server-backup-scope`), a schema-scheduled run (`kind='schema'`) should refresh only the schema — capture + sync the table/field/view structure and **skip** record paging, CSV writes, and attachments. This keeps the Schema page current cheaply between full data backups (fewer credits, no storage churn).

## What Changes

- `BackupBaseTaskPayload` gains `kind: 'full' | 'schema'` (set by `server-backup-scope`'s run-start).
- In `backup-base.ts`, branch on `kind`: a `schema` run captures the base schema and POSTs it to `/schema-sync` (as today), then **skips** the per-table record/CSV/attachment loop and reports `recordsProcessed=0` / `attachmentsProcessed=0` with the schema `tableDetail` (table/field counts). A `full` run is unchanged.
- The completion callback shape is unchanged; a schema run simply reports zero records/attachments.

## Capabilities

### New Capabilities
- `schema-only-backup`: the per-base backup task honors `kind='schema'` by capturing/syncing schema only and skipping record + attachment work.

### Modified Capabilities
<!-- Refines backup-base (workflows). Full runs are unchanged. -->

## Impact

- [apps/workflows/trigger/tasks/backup-base.ts](../../../apps/workflows/trigger/tasks/backup-base.ts) — read `kind`; gate the record/CSV/attachment loop behind `kind==='full'`.
- [apps/workflows/trigger/tasks/backup-base.task.ts](../../../apps/workflows/trigger/tasks/backup-base.task.ts) — pass `kind` from the payload.
- Tests: `apps/workflows/tests/backup-base.test.ts` — a `kind='schema'` run syncs schema, writes no CSV, reports zero records/attachments; a `kind='full'` run is unchanged.
- **Pairs with** `server-backup-scope` (sets `kind`) + `web-backup-schedule-and-scope` (UI). Cross-app contract: `BackupBaseTaskPayload.kind`.
- **Security**: no new surface; engine callbacks unchanged.
