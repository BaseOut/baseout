# Implementation tasks

## 1. Incremental-backup task

- [ ] 1.1 New `apps/workflows/trigger/tasks/incremental-backup.task.ts` — thin wrapper; pure module `incremental-backup.ts` taking injected deps. Payload: `{ runId, spaceId, subscriptionId, baseId, connectionId, cursor, reconcile }`. Opens the pass as `bo_at_base_runs` with `run_type='incremental'`.
- [ ] 1.2 `_lib/airtable-payloads.ts` — payloads client: `GET /v0/bases/:baseId/webhooks/:webhookId/payloads?cursor=` loop (≤50/page) while `mightHaveMore`; tolerant typed parsing (all change maps optional; unknown keys logged); error-payload variant (`INVALID_HOOK`/`INVALID_FILTERS`/`INTERNAL_ERROR`); cursor-expiry detection.
- [ ] 1.3 Schema-application module (per payload, before records): created/destroyed tables + fields → lifecycle (destroys = confident `removed` + cascade); `changedFieldsById`/`changedMetadata` → entity updates + `bo_at_schema_updates` with before/after + `breaks_data`; description writes touch only `description`; `changedViewsById` gated on Enterprise view capture.
- [ ] 1.4 Record-application module: `createdRecordsById` → records + sparse rfd (no first-population log); `changedRecordsById` → superseded-value log from stored rfd value, value-equality idempotency guard, drift counting vs payload `previous`; `destroyedRecordIds` → `status='deleted'`. `unchanged` values sampled for drift only.
- [ ] 1.5 Attribution: thread `actionMetadata` → `action_source` + `actor` onto every payload-derived schema/record update row.
- [ ] 1.6 End-of-pass (schema events only): meta-API full-schema fetch → hash-deduped `bo_at_schema_versions` insert + verify vs applied state (mismatch → `reconcile=true`); regenerate affected per-table views / refresh matviews.
- [ ] 1.7 Cursor callback after each durably-applied batch: POST `/api/internal/webhook-subscriptions/:id/cursor`.
- [ ] 1.8 Reconciliation pass: trigger on `reconcile=true` | drift threshold | verification mismatch | table created this pass. `LAST_MODIFIED_TIME() > last_reconciled_at` paging (extend `_lib/airtable-client.ts` if needed) + record-ID deletion sweep; `reconciled_records` counted separately; no attribution on reconciliation writes.
- [ ] 1.9 Fallback: `INVALID_HOOK`/`INVALID_FILTERS` or cursor-expiry → POST `/api/internal/webhook-subscriptions/:id/fallback` with reason, exit `{ status: 'fallback_to_full' }`; `INTERNAL_ERROR` → skip transaction + `reconcile=true`.
- [ ] 1.10 Engine progress/completion callbacks with created/updated/deleted/reconciled counts; all Airtable calls through the shared client + per-Connection gateway.

## 2. Tests

- [ ] 2.1 `apps/workflows/tests/incremental-backup.test.ts` — fixture payload streams: happy path (cursor per batch); schema-before-records ordering (field created + populated in one transaction); destroys (table/field/record) → confident `removed` + cascade; superseded-value log uses stored rfd value; drift seed (payload `previous` ≠ stored) → counter + reconcile flip; attribution threading; multi-page `mightHaveMore`; mid-batch retry idempotency; created-table partial fill → forced reconcile; error payloads (all three codes); cursor-expiry → fallback; record-only pass makes no meta call; schema pass regenerates views.
- [ ] 2.2 Reconciliation: catches seeded payload-stream miss; deletion sweep; `reconciled_records` reporting.
- [ ] 2.3 Task wrapper test: payload → pure-module deps adaptation.

## 3. Verification

- [ ] 3.1 `pnpm --filter @baseout/workflows typecheck && pnpm --filter @baseout/workflows test` — green.
