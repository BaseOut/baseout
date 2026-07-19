## ADDED Requirements

### Requirement: Payloads-API-primary incremental pass

The `incremental-backup` task SHALL pull changes from Airtable's `list webhook payloads` endpoint starting at the subscription's `payload_cursor`, looping while `mightHaveMore=true`, and apply them to the per-space dynamic DB: record created/updated → UPSERT; `destroyedRecordIds` → deletion; field/table (`tableFields`/`tableMetadata`) changes → schema changelog entries. After each durably-applied batch it SHALL POST the new cursor to `/api/internal/webhook-subscriptions/:id/cursor`. Application SHALL be idempotent so a retried batch (cursor not yet advanced) converges to the same state.

#### Scenario: Happy-path delta

- **WHEN** the task runs with cursor N and Airtable returns payloads N..M with `mightHaveMore=false`
- **THEN** all record changes are applied to the per-space DB, deletions from `destroyedRecordIds` are applied, and the cursor callback is POSTed with M

#### Scenario: Retry after mid-batch failure

- **WHEN** the task fails after applying a batch but before the cursor callback succeeds
- **THEN** the retried attempt re-fetches from the stored cursor and re-applies idempotently (UPSERT/delete semantics), ending in the same state

#### Scenario: Deletion propagates

- **WHEN** a payload lists a record ID in `destroyedRecordIds`
- **THEN** the corresponding per-space row is marked deleted per the per-space DB deletion model

### Requirement: modifiedTime reconciliation catch-all

The task SHALL support a reconciliation pass using the records API — paging records where `LAST_MODIFIED_TIME() > anchor` (anchor = `last_reconciled_at`) and upserting differences — run when the payload `reconcile=true` OR the payload pass reports anomalies. Because `modifiedTime` paging cannot observe deletions, the reconciliation pass SHALL also perform a record-ID sweep (fields-free listing) and mark per-space rows absent from the source as deleted. This path exists because Airtable's payload stream can miss changes; both paths are first-class.

#### Scenario: Scheduled reconciliation

- **WHEN** the task runs with `reconcile=true`
- **THEN** after the payload pass it pages records modified since `last_reconciled_at`, applies any differences the payload stream missed, sweeps record IDs for deletions, and reports reconciliation counts in the completion callback

#### Scenario: Reconciliation finds a payload-stream miss

- **WHEN** the reconciliation pass finds a record whose source state differs from the per-space DB despite the payload pass having completed
- **THEN** the difference is applied, counted separately (`reconciled_records`), and surfaced in the run detail so payload-stream reliability is observable

### Requirement: Gap fallback to full re-read

On a payload-stream error, or when Airtable indicates the stored cursor is no longer valid (outside the 7-day payload retention), the task SHALL abort the incremental path, POST `/api/internal/webhook-subscriptions/:id/fallback` with the reason, and exit with `{ status: 'fallback_to_full' }`. The server side enqueues the full `backup-base` run.

#### Scenario: Cursor expired

- **WHEN** the payloads endpoint indicates the cursor predates retained payloads
- **THEN** the task POSTs the fallback callback and exits `fallback_to_full` without partial application

### Requirement: Rate-budget compliance

All Airtable calls in both passes SHALL go through the shared client and the per-Connection gateway, honoring the 5 requests/second per-base budget shared with snapshot backups and schema reads.

#### Scenario: Concurrent snapshot on the same base

- **WHEN** the incremental task polls payloads while a full snapshot of the same base is running
- **THEN** both workloads' requests are serialized through the same gateway without tripping Airtable 429s

### Requirement: Pure-orchestration module is unit-testable

The task SHALL be implemented as a pure async function taking injected deps (`db` factories, `fetchImpl`, `now`, engine-callback client), with a thin Trigger.dev wrapper. Tests SHALL drive fixture payload streams (including `destroyedRecordIds`, schema events, multi-page `mightHaveMore` sequences, cursor-expiry errors) without hitting the real Airtable API.

#### Scenario: Fixture-driven tests

- **WHEN** tests exercise the pure module with fixture payloads
- **THEN** they assert per-space DB end-state, cursor-callback sequence, reconciliation diffs, and fallback signaling with a stubbed `fetchImpl`
