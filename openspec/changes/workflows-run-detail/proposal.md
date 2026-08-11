# workflows-run-detail — Per-table detail in the completion POST

## Why

`server-run-detail` (commit 050c396) added `backup_run_bases` and
`backup_run_tables` snapshot tables and extended the
`POST /api/internal/runs/:runId/complete` handler to accept optional
`baseName` + `tables[]` detail. The handler now has the infrastructure to
persist per-table breakdowns, but the Trigger.dev task never sends those
fields — so the new tables stay empty on every real backup run.

This change extends the backup-base task wrapper (`backup-base.task.ts`)
to accumulate per-table detail during the existing table loop and include
it in the completion POST. The result: every real backup run from this
point forward populates `backup_run_bases` / `backup_run_tables`, enabling
the `web-run-detail` follow-on to render a per-base/per-table tree without
any further backend work.

## What Changes

### `backup-base.ts` — accumulate per-table detail (additive)

`BackupBaseResult` gains an optional `tableDetail` field:

```ts
tableDetail?: Array<{
  tableId: string
  tableName: string
  recordCount: number
  fieldCount: number
  attachmentCount: number
}>
```

During the existing `for (const table of tables)` loop the function
appends one entry per table, using data already on hand:

- `tableId` / `tableName` — from the Airtable schema (`table.id` / `table.name`)
- `recordCount` — `collected.length` (rows written to CSV for that table)
- `fieldCount` — `table.fields.length` (from Airtable schema)
- `attachmentCount` — delta of `attachmentsProcessed` for that table pass

`baseName` is already present on `BackupBaseInput` and can be forwarded
by the wrapper. No new input fields required.

### `backup-base.task.ts` — forward to the `/complete` POST (additive)

`postCompletion` receives the new optional fields and spreads them into
the JSON body **only when present** — the server side is already guarded
to handle both present and absent:

```ts
...(result.tableDetail
  ? { baseName: payload.baseName, tables: result.tableDetail }
  : {}),
```

Existing completion fields (`triggerRunId`, `atBaseId`, `status`,
`tablesProcessed`, `recordsProcessed`, `attachmentsProcessed`,
`errorMessage`) are **unchanged**.

## Cross-app contract

Completion POST body shape after this change:

```ts
{
  triggerRunId: string
  atBaseId: string
  status: "succeeded" | "trial_truncated" | "trial_complete" | "failed"
  tablesProcessed: number
  recordsProcessed: number
  attachmentsProcessed: number
  errorMessage?: string
  // NEW — only present on non-failed runs with per-table detail:
  baseName?: string
  tables?: Array<{
    tableId: string
    tableName: string
    recordCount: number
    fieldCount: number
    attachmentCount: number
  }>
}
```

Server contract (`server-run-detail` proposal §Cross-app contract) is met exactly.

## Out of Scope

- Web run-detail view wiring — tracked in `web-run-detail`
- `startedAt` per base — the task does not currently track per-base start
  time; left as NULL (server default). A follow-on can add it.

## Cross-references

- **Predecessor:** `server-run-detail` — the server foundation (schema + handler extension)
- **Follow-on:** `web-run-detail` — wires the `GET /detail` response into the run-detail view
