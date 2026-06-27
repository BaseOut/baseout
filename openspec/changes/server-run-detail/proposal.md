# server-run-detail — Per-run base/table snapshot

## Why

The run-detail UI currently shows `metricsPending` placeholders — it has the
overall run aggregates (record_count, table_count on backup_runs) but no
per-base or per-table breakdown. This change adds two snapshot tables and
extends the `/complete` callback (additive, optional) so the Trigger.dev
task can write a fine-grained breakdown as part of its existing completion
call. A new detail read endpoint lets the web tier assemble the full tree.

This is the **server foundation only**. The workflows follow-on
(`workflows-run-detail`) extends the backup-base task wrapper to send the
per-table payload, and the web follow-on (`web-run-detail`) wires the
detail-route response into the run-detail view.

## What Changes

### Schema (canonical in apps/web; mirrored in apps/server)

**`backup_run_bases`** — one row per per-base completion that carries table detail:
- `id` text PK (gen_random_uuid), `run_id` FK → backup_runs (cascade),
  `at_base_id`, `base_name`, `status`, `tables_count` int default 0,
  `records_count` int default 0, `attachments_count` int default 0,
  `started_at` timestamptz, `completed_at` timestamptz, `error_message`,
  `created_at` timestamptz default now. Index on `run_id`.

**`backup_run_tables`** — one row per table within a base snapshot:
- `id` text PK, `run_base_id` FK → backup_run_bases (cascade), `table_id`,
  `table_name`, `record_count` int default 0, `field_count` int default 0,
  `attachment_count` int default 0, `created_at` timestamptz default now.
  Index on `run_base_id`.

### Completion contract (ADDITIVE — existing path unchanged)

New optional fields on the POST `/api/internal/runs/:runId/complete` body:

```ts
baseName?: string           // display name of the base
tables?: Array<{
  tableId: string
  tableName: string
  recordCount: number
  fieldCount: number
  attachmentCount: number
}>
```

When `tables` (+ `baseName`) are present, the handler also inserts one
`backup_run_bases` row and its `backup_run_tables` rows. When absent the
handler behaves **identically to today** — the existing aggregate path is
untouched.

`atBaseId` is already a required field on the completion body; it is reused
as the FK value for `backup_run_bases.at_base_id`.

### New endpoint

`GET /api/internal/runs/:runId/detail` (INTERNAL_TOKEN-gated):

```json
{
  "bases": [
    {
      "atBaseId": "appXXX",
      "baseName": "My Base",
      "status": "succeeded",
      "tablesCount": 3,
      "recordsCount": 120,
      "attachmentsCount": 0,
      "startedAt": null,
      "completedAt": "2026-06-26T12:00:00.000Z",
      "errorMessage": null,
      "tables": [
        { "tableId": "tblXXX", "tableName": "Contacts", "recordCount": 80,
          "fieldCount": 5, "attachmentCount": 0 }
      ]
    }
  ]
}
```

Returns 404 if the parent run row doesn't exist, 400 on malformed UUID.
An empty `bases` array is a valid 200 response (no per-table detail yet
sent by the task — e.g. legacy completions before the workflows follow-on).

## Cross-app contract (for workflows-run-detail follow-on)

The `backup-base.task.ts` wrapper must send these additional fields on
POST `/api/internal/runs/:runId/complete`:

```ts
baseName: string               // base.name from Airtable schema
tables: Array<{
  tableId: string              // table.id from Airtable schema
  tableName: string            // table.name from Airtable schema
  recordCount: number          // rows written to CSV
  fieldCount: number           // fields in the table schema
  attachmentCount: number      // attachments downloaded for the table
}>
```

`atBaseId` is already sent; no change needed there.

## Out of Scope

- Workflows payload extension — tracked in `workflows-run-detail`
- Web run-detail view wiring — tracked in `web-run-detail`
- `startedAt` column on `backup_run_bases` is written as `NULL` for now;
  the workflows task can backfill it once it captures start time per base.
