## Why

Workflows-side counterpart to [`server-instant-webhook`](../server-instant-webhook/proposal.md). The server side owns the webhook registry, per-Space subscriptions, SpaceDO cadence polling, lifecycle, and the cursor/fallback callback routes. This change owns the Trigger.dev task that performs the incremental backup once a Space's poll tick has found a dirty base.

**Dual-path decision (settled 2026-07-18):** the task is **payloads-API-primary** — Airtable's `list webhook payloads` endpoint returns the actual changes (cell values, previous values, and explicit `destroyedRecordIds`) from the subscription's cursor, so no separate record fetch is needed on the happy path. But the payload stream is known to occasionally miss changes, so the task ALSO supports a **records-API `modifiedTime` reconciliation path** as a catch-all: page records where `LAST_MODIFIED_TIME() > anchor` and diff against the per-space DB. Each path covers the other's blind spot — payloads see deletions that `modifiedTime` paging cannot; `modifiedTime` sweeps catch changes the payload stream dropped.

## What Changes

- New task `apps/workflows/trigger/tasks/incremental-backup.task.ts` (pure module + thin wrapper per CLAUDE.md §6). Payload: `{ runId, spaceId, subscriptionId, baseId, connectionId, cursor, reconcile }`.
- **Payload pass (primary)**: loop `GET /v0/bases/{baseId}/webhooks/{webhookId}/payloads?cursor=` while `mightHaveMore=true`; apply each payload's changes to the per-space dynamic DB (created/updated → UPSERT; `destroyedRecordIds` → delete; `tableFields`/`tableMetadata` changes → schema changelog); POST the new cursor to `/api/internal/webhook-subscriptions/:id/cursor` after each durably-applied batch.
- **Reconciliation pass (catch-all)**: when `reconcile=true` (server sets it when `last_reconciled_at` > 7 days old) or the payload pass reports anomalies, page records by `LAST_MODIFIED_TIME() > last_reconciled_at`, upsert differences, and reconcile deletions via a record-ID sweep (list record IDs only; delete per-space rows absent from the source).
- **Gap fallback**: on a payload-stream error or a cursor outside Airtable's 7-day retention, abort the incremental path and POST `/api/internal/webhook-subscriptions/:id/fallback` so `server` enqueues a full `backup-base` run.
- Engine progress/completion callbacks per the standard run contract; completion aggregates created/updated/deleted counts.
- All Airtable calls via the shared client through the per-Connection gateway (5 rps per-base budget is shared with snapshots and schema reads).

## Out of Scope

- Registry schema, SpaceDO polling, lifecycle, callback routes — [`server-instant-webhook`](../server-instant-webhook/proposal.md).
- The public receiver — [`hooks`](../hooks/proposal.md).
- The dynamic-DB write helpers themselves — `server-dynamic-mode` (this task consumes them).
- Conflict resolution beyond last-write-wins — future `server-instant-conflict-resolution`.

## Capabilities

### New Capabilities

- `incremental-backup-task`: payloads-primary incremental backup with `modifiedTime` reconciliation catch-all and full-re-read gap fallback.

### Modified Capabilities

None.
