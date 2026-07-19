## Why

Workflows-side counterpart to [`server-instant-webhook`](../server-instant-webhook/proposal.md). The server side owns the webhook registry, per-Space subscriptions, SpaceDO cadence polling, lifecycle, and the cursor/fallback callback routes. This change owns the Trigger.dev task that performs the incremental backup once a Space's poll tick has found a dirty base.

**Dual-path decision (settled 2026-07-18):** the task is **payloads-API-primary** — Airtable's `list webhook payloads` endpoint returns the actual changes (cell values, previous values, and explicit `destroyedRecordIds`) from the subscription's cursor, so no separate record fetch is needed on the happy path. But the payload stream is known to occasionally miss changes, so the task ALSO supports a **records-API `modifiedTime` reconciliation path** as a catch-all: page records where `LAST_MODIFIED_TIME() > anchor` and diff against the per-space DB. Each path covers the other's blind spot — payloads see deletions that `modifiedTime` paging cannot; `modifiedTime` sweeps catch changes the payload stream dropped.

## What Changes

- New task `apps/workflows/trigger/tasks/incremental-backup.task.ts` (pure module + thin wrapper per CLAUDE.md §6). Payload: `{ runId, spaceId, subscriptionId, baseId, connectionId, cursor, reconcile }`. Each pass runs as a `bo_at_base_runs` row with `run_type='incremental'` (per-space model deltas specced in [`system-per-space-db`](../system-per-space-db/design.md)).
- **Payload pass (primary)**: loop `GET /v0/bases/{baseId}/webhooks/{webhookId}/payloads?cursor=` (≤50/page) while `mightHaveMore=true`, applying in `baseTransactionNumber` order — schema events before record events within each payload:
  - Schema: `createdTablesById`/`createdFieldsById` → lifecycle inserts; `destroyedTableIds`/`destroyedFieldIds` → confident `removed` (+cascade); `changedFieldsById`/`changedMetadata` → entity update + `bo_at_schema_updates` (before/after, `breaks_data` on retypes); `changedViewsById` → `bo_at_views` only when Enterprise view capture is on. Description writes touch only `description`, never the ai/override columns.
  - Records: `createdRecordsById` → `bo_at_records` + sparse rfd rows (no log on first population); `changedRecordsById` → superseded-value log from OUR stored rfd value (payload `previous` used only for drift detection), value-equality guard for idempotent replays; `destroyedRecordIds` → `status='deleted'`.
  - **Attribution**: every payload-derived `bo_at_schema_updates`/`bo_at_record_updates` row carries `action_source` + `actor` from `actionMetadata` — the one thing only this path can capture (payloads purge after 7 days).
  - POST the new cursor to `/api/internal/webhook-subscriptions/:id/cursor` after each durably-applied batch.
- **End-of-pass schema snapshot (only when schema events occurred)**: one `GET /v0/meta/bases/{baseId}/tables` → hash-deduped `bo_at_schema_versions` insert + verification against the payload-applied state (disagreement = payload-stream miss → `reconcile=true`), then regenerate affected per-table query views (retypes change the safe-casts). Record-only passes make zero extra API calls.
- **Reconciliation pass (catch-all)**: when `reconcile=true` (server sets it when `last_reconciled_at` > 7 days old), drift/verification triggers fired, or a table was created this pass (its `recordsById` may be partial) — page records by `LAST_MODIFIED_TIME() > last_reconciled_at`, upsert differences, and reconcile deletions via a record-ID sweep. Reconciliation writes carry no attribution.
- **Error payloads + gap fallback**: `INVALID_HOOK`/`INVALID_FILTERS` → fallback callback (server re-creates the webhook + full re-read); `INTERNAL_ERROR` → skip transaction + `reconcile=true`; cursor outside the 7-day retention → fallback with `cursor_expired`, no partial application.
- Engine progress/completion callbacks per the standard run contract; completion aggregates created/updated/deleted/`reconciled_records` counts.
- All Airtable calls via the shared client through the per-Connection gateway (5 rps per-base budget is shared with snapshots and schema reads).
- Tolerant parsing per Airtable's contract: no optional payload field assumed present; unknown keys logged, never fatal.

## Out of Scope

- Registry schema, SpaceDO polling, lifecycle, callback routes — [`server-instant-webhook`](../server-instant-webhook/proposal.md).
- The public receiver — [`hooks`](../hooks/proposal.md).
- The per-space model deltas this task relies on (`bo_at_base_runs.run_type`, attribution columns, destroy-event removal rule) — [`system-per-space-db`](../system-per-space-db/design.md) (resolved 2026-07-18).
- The dynamic-DB write helpers themselves — `server-dynamic-mode` (this task consumes them).
- Conflict resolution beyond last-write-wins — future `server-instant-conflict-resolution`.

## Capabilities

### New Capabilities

- `incremental-backup-task`: payloads-primary incremental backup with `modifiedTime` reconciliation catch-all and full-re-read gap fallback.

### Modified Capabilities

None.
