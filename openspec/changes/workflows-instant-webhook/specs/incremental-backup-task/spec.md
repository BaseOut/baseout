## ADDED Requirements

### Requirement: Payloads-API-primary incremental pass

The `incremental-backup` task SHALL pull changes from Airtable's `list webhook payloads` endpoint starting at the subscription's `payload_cursor` (up to 50 payloads per request), looping while `mightHaveMore=true`, and apply payloads in `baseTransactionNumber` order. Each pass runs under an incremental run context: a `bo_at_base_runs` row with `run_type='incremental'` — lifecycle updates from this pass touch only entities the payloads mention (per the per-space-db lifecycle rules). After each durably-applied batch the task SHALL POST the new cursor to `/api/internal/webhook-subscriptions/:id/cursor`. The parser SHALL be tolerant per Airtable's contract: no optional payload field may be assumed present, and unknown keys are logged, never fatal.

#### Scenario: Happy-path delta

- **WHEN** the task runs with cursor N and Airtable returns payloads N..M with `mightHaveMore=false`
- **THEN** all changes are applied in transaction order under the incremental run and the cursor callback is POSTed with M

#### Scenario: Retry after mid-batch failure

- **WHEN** the task fails after applying a batch but before the cursor callback succeeds
- **THEN** the retried attempt re-fetches from the stored cursor and re-applies idempotently (value-equality guards make replays no-ops), ending in the same state

### Requirement: Schema events apply before record events

Within each payload, schema changes SHALL be applied before record changes (incoming `cellValuesByFieldId` may reference fields created in the same transaction), mapped onto the per-space model as follows:

- `createdTablesById` → INSERT `bo_at_tables` (+ `fieldsById` → `bo_at_fields`; `recordsById` → the record path), `first_seen_run` = this run.
- `destroyedTableIds` → `bo_at_tables.status='removed'`, `first_unseen_run` = this run, cascading to child fields/records per the established cascade rules.
- `createdFieldsById` → INSERT `bo_at_fields`, `first_seen_run` = this run.
- `changedFieldsById` → UPDATE `bo_at_fields` and append `bo_at_schema_updates` (payload `previous` as before, `current` as after; `breaks_data` on type changes).
- `destroyedFieldIds` → `bo_at_fields.status='removed'`, `first_unseen_run` = this run.
- `changedMetadata` → UPDATE table `name`/`description` + `bo_at_schema_updates` row. Description writes touch ONLY the `description` column, never `ai_description`/`description_override`.
- `changedViewsById` → applied to `bo_at_views` only when the Space's Enterprise view capture is enabled; otherwise skipped.

Explicit destroy events SHALL set `status='removed'` directly (a confident removal source per the per-space-db spec) — never `unknown`.

#### Scenario: Field created and populated in one transaction

- **WHEN** a payload contains a field in `createdFieldsById` and record changes referencing that field id
- **THEN** the field row exists before the cell writes and both apply within the same run

#### Scenario: Destroyed field removes confidently

- **WHEN** a payload lists a field in `destroyedFieldIds`
- **THEN** the `bo_at_fields` row is set `removed` with `first_unseen_run` = this incremental run, and the change appears in the changelog without waiting for a full run

### Requirement: Record events onto the sparse cell model

Record changes SHALL apply onto `bo_at_records` / `bo_at_record_field_data` / `bo_at_record_updates` per their established semantics:

- `createdRecordsById` → INSERT `bo_at_records` (payload `createdTime`, `first_seen_run` = this run) + one rfd row per cell value (JSON-encoded). First population logs nothing.
- `changedRecordsById` → per changed field: existing rfd row → append `bo_at_record_updates` with the superseded value **from our stored rfd row** (not the payload's `previous`), then update rfd; no rfd row → create it, log nothing; old value equals new value → skip both (idempotent replays). Update `modified_time` from the payload timestamp; bump `last_seen_run`.
- `destroyedRecordIds` → `bo_at_records.status='deleted'`, `first_unseen_run` = this run; rfd rows retained.
- Payload `previous` values SHALL NOT be written anywhere; when payload `previous` disagrees with our stored rfd value, the task SHALL count the mismatch as drift.
- `unchanged` cell values SHALL NOT be applied; they MAY be sampled for drift detection.

Drift counts above a configured threshold SHALL flip the pass to `reconcile=true`.

#### Scenario: Cell change logs our superseded value

- **WHEN** a payload changes a cell whose rfd row holds V while the payload claims `previous` was P ≠ V
- **THEN** `bo_at_record_updates` logs `old_value = V`, the drift counter increments, and rfd gets the payload's current value

#### Scenario: Deletion propagates

- **WHEN** a payload lists a record ID in `destroyedRecordIds`
- **THEN** the `bo_at_records` row is marked `deleted` with `first_unseen_run` = this run and its cell rows persist for history

### Requirement: Attribution capture from actionMetadata

Every `bo_at_schema_updates` and `bo_at_record_updates` row written from a payload SHALL carry `action_source` and `actor` from the payload's `actionMetadata` (source kind + acting user as available). This is the only pipeline that can capture attribution (snapshot diffing cannot; payloads purge after 7 days).

#### Scenario: Changelog renders who and how

- **WHEN** a payload's `actionMetadata` identifies a field retype as performed by user U via the public API
- **THEN** the `bo_at_schema_updates` row carries `action_source='publicApi'` and `actor` = U, renderable as "changed by U via API"

### Requirement: End-of-pass schema snapshot and view regeneration

When a pass applied ANY schema event, the task SHALL fetch the full base schema once (`GET /v0/meta/bases/{baseId}/tables`), hash it, insert a `bo_at_schema_versions` row if the hash changed, link it to the run, and verify the fetched schema against the payload-applied state — a disagreement counts as a payload-stream miss and flips `reconcile=true`. The task SHALL then regenerate the affected per-table query views (and refresh Postgres materialized views), since field-type changes alter the views' casts. Record-only passes SHALL skip both the meta fetch and regeneration.

#### Scenario: Record-only pass costs no schema calls

- **WHEN** a pass's payloads contain only record changes
- **THEN** no meta-API call is made and no view regeneration occurs

#### Scenario: Field retype regenerates views in the same pass

- **WHEN** a pass applies a field type change
- **THEN** the affected table's generated view is regenerated with the new safe-casts before the run completes

### Requirement: modifiedTime reconciliation catch-all

The task SHALL support a reconciliation pass using the records API — paging records where `LAST_MODIFIED_TIME() > anchor` (anchor = `last_reconciled_at`) and upserting differences — run when the payload `reconcile=true` OR drift/verification triggers fired during the pass. Because `modifiedTime` paging cannot observe deletions, the reconciliation pass SHALL also perform a record-ID sweep (fields-free listing) and mark per-space rows absent from the source as deleted. A table arriving via `createdTablesById` SHALL be treated as `reconcile=true` for its first pass (its `recordsById` may be partial for large pasted-in tables). Reconciliation-sourced writes carry no attribution (null `action_source`/`actor`).

#### Scenario: Scheduled reconciliation

- **WHEN** the task runs with `reconcile=true`
- **THEN** after the payload pass it pages records modified since `last_reconciled_at`, applies differences the payload stream missed, sweeps record IDs for deletions, and reports `reconciled_records` in the completion callback

#### Scenario: Newly created table gets a full fill

- **WHEN** a payload created a table in this pass
- **THEN** the reconciliation path fully pages that table's records regardless of what `recordsById` contained

#### Scenario: Reconciliation finds a payload-stream miss

- **WHEN** the reconciliation pass finds a record whose source state differs from the per-space DB despite a completed payload pass
- **THEN** the difference is applied and counted in `reconciled_records`, keeping payload-stream reliability observable in the run detail

### Requirement: Error payloads and gap fallback

Error payloads and stream failures SHALL map to recovery paths: `INVALID_HOOK` or `INVALID_FILTERS` → POST `/api/internal/webhook-subscriptions/:id/fallback` with the code (server re-creates the webhook and enqueues a full re-read); `INTERNAL_ERROR` → skip that transaction and flip `reconcile=true`. When Airtable indicates the stored cursor predates retained payloads (7-day purge), the task SHALL abort without partial application and POST the fallback with reason `cursor_expired`, exiting `{ status: 'fallback_to_full' }`.

#### Scenario: Cursor expired

- **WHEN** the payloads endpoint indicates the cursor predates retained payloads
- **THEN** the task POSTs the fallback callback and exits `fallback_to_full` without partial application

#### Scenario: Airtable internal error on one transaction

- **WHEN** a payload arrives with `error: true, code: 'INTERNAL_ERROR'`
- **THEN** the task skips it, continues the pass, and runs the reconciliation path to cover the opaque transaction

### Requirement: Rate-budget compliance

All Airtable calls in every pass (payload polls, meta fetch, reconciliation paging) SHALL go through the shared client and the per-Connection gateway, honoring the 5 requests/second per-base budget shared with snapshot backups and schema reads.

#### Scenario: Concurrent snapshot on the same base

- **WHEN** the incremental task polls payloads while a full snapshot of the same base is running
- **THEN** both workloads' requests are serialized through the same gateway without tripping Airtable 429s

### Requirement: Pure-orchestration module is unit-testable

The task SHALL be implemented as a pure async function taking injected deps (`db` factories, `fetchImpl`, `now`, engine-callback client), with a thin Trigger.dev wrapper. Tests SHALL drive fixture payload streams (schema + record events, `destroyedRecordIds`/`destroyedFieldIds`/`destroyedTableIds`, created-table partial fills, multi-page `mightHaveMore`, drift seeds, error payloads, cursor-expiry) without hitting the real Airtable API.

#### Scenario: Fixture-driven tests

- **WHEN** tests exercise the pure module with fixture payloads
- **THEN** they assert per-space DB end-state (schema + records + logs + attribution), cursor-callback sequence, drift/reconcile triggering, view-regeneration calls, and fallback signaling with a stubbed `fetchImpl`
