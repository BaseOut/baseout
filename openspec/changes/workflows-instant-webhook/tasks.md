# Implementation tasks

## 1. Incremental-backup task

- [ ] 1.1 New `apps/workflows/trigger/tasks/incremental-backup.task.ts` — thin wrapper; pure module `incremental-backup.ts` taking injected deps. Payload: `{ runId, spaceId, subscriptionId, baseId, connectionId, cursor, reconcile }`.
- [ ] 1.2 `_lib/airtable-payloads.ts` — payloads client: `GET /v0/bases/:baseId/webhooks/:webhookId/payloads?cursor=` loop while `mightHaveMore`; typed payload parsing (record changes, `destroyedRecordIds`, field/table events); cursor-expiry error detection.
- [ ] 1.3 Apply-changes module: created/updated → UPSERT into per-space dynamic DB (via `server-dynamic-mode` helpers); `destroyedRecordIds` → deletion per the per-space model; schema events → schema changelog entries. Idempotent by construction.
- [ ] 1.4 Cursor callback: POST `/api/internal/webhook-subscriptions/:id/cursor` after each durably-applied batch.
- [ ] 1.5 Reconciliation pass (when `reconcile=true` or payload anomalies): extend `_lib/airtable-client.ts` `listRecords` with `filterByFormula` on `LAST_MODIFIED_TIME()` if not present; upsert diffs; record-ID sweep for deletion reconciliation; count `reconciled_records` separately.
- [ ] 1.6 Gap fallback: POST `/api/internal/webhook-subscriptions/:id/fallback` + exit `{ status: 'fallback_to_full' }` on payload-stream error or expired cursor.
- [ ] 1.7 Engine progress/completion callbacks with created/updated/deleted/reconciled counts.
- [ ] 1.8 All Airtable calls through the shared client + per-Connection gateway.

## 2. Tests

- [ ] 2.1 `apps/workflows/tests/incremental-backup.test.ts` — fixture payload streams: happy path (cursor advances per batch), multi-page `mightHaveMore`, `destroyedRecordIds`, schema events, mid-batch retry idempotency, cursor-expiry → fallback, reconciliation catching a seeded payload-stream miss + deletion sweep.
- [ ] 2.2 Task wrapper test: payload → pure-module deps adaptation.

## 3. Verification

- [ ] 3.1 `pnpm --filter @baseout/workflows typecheck && pnpm --filter @baseout/workflows test` — green.
