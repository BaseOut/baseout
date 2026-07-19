# service-run-log

## ADDED Requirements

### Requirement: service_runs table records every background-service execution
The master DB SHALL contain a `service_runs` table, canonical in `apps/web/src/db/schema/core.ts` with the migration owned by `apps/web` (web owns all master-DB migrations). Each row SHALL represent one execution of one background service with: `id` (UUID PK), `service` (text identifier from the service registry), `status` (`started | succeeded | failed`), `started_at` (not null), `completed_at` (null until finalized), `duration_ms` (null until finalized), `counts` (jsonb, per-service counters such as scanned/refreshed/failed), `error_message` (text, null unless failed), and `created_at` / `modified_at` per repo convention. The table SHALL be indexed to make "latest runs per service" cheap (at minimum an index on `(service, started_at)`).

#### Scenario: Job start inserts a started row
- **WHEN** a background service begins an execution under the writer contract
- **THEN** a `service_runs` row exists with `status = 'started'`, the service's registry identifier, and a non-null `started_at`, before the job body runs

#### Scenario: Successful finalize completes the same row
- **WHEN** the job body completes without throwing
- **THEN** the same row is updated to `status = 'succeeded'` with `completed_at` set, `duration_ms` equal to the finalize-minus-start elapsed time, and the job's counters recorded in `counts`

#### Scenario: Failed finalize records the error
- **WHEN** the job body throws
- **THEN** the same row is updated to `status = 'failed'` with `completed_at` set and `error_message` containing the thrown error's message, and the error is re-thrown/logged exactly as it would have been without instrumentation

### Requirement: withServiceRun writer helper is the single write path
`apps/server` SHALL provide a `withServiceRun()` helper (in `src/lib/service-runs.ts`) that wraps a job body and owns the full row lifecycle (insert `started`, execute, finalize `succeeded`/`failed`). All writes to `service_runs` SHALL go through this helper or the engine-mediated open/finalize functions from the same module — no ad-hoc INSERT/UPDATE call sites. The module SHALL also export the service-identifier registry: live identifiers `oauth_refresh_sweep`, `run_reconciliation`, `oauth_keepalive`, `connection_auto_invalidate`, `retention_cleanup`, `service_runs_prune`, and reserved identifiers for specced-but-unbuilt services (`webhook_renewal`, `connection_lock_sweep`, `dead_connection_check`, `rediscovery`, `trial_expiry_monitor`, `quota_usage_monitor`).

#### Scenario: Every live cron job runs under the helper
- **WHEN** the Worker `scheduled()` dispatch fires any of `oauth-refresh-sweep`, `run-reconciliation`, `oauth-keepalive`, or `connection-auto-invalidate`
- **THEN** each job's execution produces exactly one `service_runs` row under its registry identifier

#### Scenario: Future scheduled jobs adopt the contract
- **WHEN** a new scheduled/cron job is added to `apps/server` (e.g. webhook renewal, connection-lock sweep)
- **THEN** it MUST execute under `withServiceRun()` with a registry identifier, and the identifier MUST be added to the registry in the same change

### Requirement: Instrumentation never breaks the job
A failure to write `service_runs` (insert or finalize) SHALL NOT fail, skip, or alter the wrapped job: the write error is logged via structured logging and swallowed, and the job body runs (or its own outcome propagates) exactly as it would without instrumentation.

#### Scenario: Insert fails, job still runs
- **WHEN** the `started` INSERT throws (e.g. transient DB unavailability) as a cron job begins
- **THEN** the job body still executes to completion and the insert error is logged, not thrown

#### Scenario: Job failure is not masked by finalize failure
- **WHEN** the job body throws and the `failed` finalize UPDATE also throws
- **THEN** the original job error is the one that propagates to the cron dispatcher's error handling

### Requirement: Trigger.dev cleanup task is instrumented via the engine
Because `apps/workflows` has no DB access, the `retention_cleanup` run row SHALL be opened by the engine's `/api/internal/cleanup-plan` handler (which returns the new row's id as `serviceRunId` in the plan response) and finalized by the cleanup-completion handler when the task posts back the outcome including that `serviceRunId`. The completion payload's `serviceRunId` SHALL be optional: a completion without it (older task build) finalizes nothing and is otherwise processed unchanged.

#### Scenario: Full cleanup pass is recorded
- **WHEN** the hourly cleanup task fetches a plan and later posts its completion with the echoed `serviceRunId`
- **THEN** the corresponding `service_runs` row transitions `started` → `succeeded` (or `failed` if the completion reports failure) with the pass counters in `counts`

#### Scenario: Task crash leaves visible evidence
- **WHEN** the cleanup task fetches a plan but never posts a completion
- **THEN** the `started` row remains un-finalized, making the crash detectable as a stuck run instead of leaving no trace

### Requirement: The log prunes itself
A `service-runs-prune` job SHALL run on the existing daily cron dispatch and DELETE `service_runs` rows with `started_at` older than 90 days. The prune itself SHALL run under `withServiceRun()` (identifier `service_runs_prune`) recording the deleted-row count in `counts`.

#### Scenario: Old rows are deleted daily
- **WHEN** the daily cron fires and rows older than 90 days exist
- **THEN** those rows are deleted and the prune's own run row records how many

### Requirement: service_runs never contains secrets or customer content
Rows SHALL contain operational metadata only. `error_message` SHALL store the thrown error's message string only (never request/response bodies, tokens, connection strings, or `*_enc` values); `counts` SHALL contain numeric counters and small enumerable labels only.

#### Scenario: Failure of a token-handling job stays safe
- **WHEN** the OAuth refresh sweep fails while holding decrypted token material
- **THEN** the recorded `error_message` contains the error message text only, with no token, header, or body content
