## ADDED Requirements

### Requirement: restore_runs lifecycle owned by apps/server
The data-plane Worker SHALL own the `restore_runs` table lifecycle (queued → running → succeeded|failed|cancelled), expose internal HTTP routes for start, progress, complete, and cancel, and fan out one Trigger.dev `restore-base` task per included base.

#### Scenario: start route fans out tasks
- **WHEN** apps/web POSTs `/api/internal/restores/:restoreId/start` with a valid `INTERNAL_TOKEN` against a `restore_runs` row in `queued`
- **THEN** apps/server SHALL validate the row, the Connection (`status='active'`), and the source backup snapshot exists
- **AND** SHALL transition the row to `running`
- **AND** SHALL enqueue one Trigger.dev task per base in `scope_target`
- **AND** SHALL persist `trigger_run_ids` on the row

#### Scenario: start route rejects already-started runs
- **WHEN** a start request targets a row whose `status` is not `'queued'`
- **THEN** the route SHALL return HTTP 409 with `{ error: 'run_already_started' }`

#### Scenario: progress aggregates per-base counts
- **WHEN** apps/workflows POSTs `/api/internal/restores/:restoreId/progress` with `{ triggerRunId, atBaseId, recordsAppended, tableCompleted }`
- **THEN** apps/server SHALL bump `restore_runs.records_restored` by `recordsAppended`
- **AND** SHALL increment `restore_runs.tables_restored` if `tableCompleted` is true
- **AND** SHALL no-op if the run row is already in a terminal state

#### Scenario: complete is idempotent
- **WHEN** apps/workflows POSTs `/api/internal/restores/:restoreId/complete` against a terminal row
- **THEN** the route SHALL return 200 without mutating the row
- **AND** SHALL log `event: 'restore_complete_idempotent_noop'`

### Requirement: cancel state machine mirrors backup-run cancel
The `/api/internal/restores/:restoreId/cancel` route SHALL CAS-transition `restore_runs` from `{queued | running}` to `cancelling`, call `runs.cancel` per `trigger_run_id`, and flip to `cancelled`. Errors from the per-task cancel call SHALL be swallowed (best-effort).

#### Scenario: cancel running run
- **WHEN** a cancel request targets a running row
- **THEN** apps/server SHALL UPDATE the row to `cancelling` via CAS on the prior status
- **AND** SHALL call `runs.cancel(triggerRunId)` for each ID in `trigger_run_ids`
- **AND** SHALL transition to `cancelled` after the cancel calls return (success or swallowed error)

#### Scenario: cancel queued run is direct
- **WHEN** a cancel request targets a queued row with empty `trigger_run_ids`
- **THEN** apps/server SHALL transition directly from `queued` to `cancelled`
- **AND** SHALL NOT call `runs.cancel`

### Requirement: Cross-app payload schema parity with backup
Restore progress and completion payloads SHALL share field names + types with the backup-side `/api/internal/runs/:runId/{progress,complete}` payloads (substituting `runId → restoreId`, `runStartedAt → restoreStartedAt`, etc.). This makes WebSocket broadcasts trivially extend to restore frames per [`shared-websocket-progress`](../../shared-websocket-progress/specs/web-live-progress/spec.md).

#### Scenario: progress payload shape
- **WHEN** any client sends a restore-progress POST
- **THEN** the payload SHALL contain `{ triggerRunId, atBaseId, recordsAppended, tableCompleted }` — same shape as backup-progress

#### Scenario: complete payload shape
- **WHEN** any client sends a restore-complete POST
- **THEN** the payload SHALL contain `{ triggerRunId, atBaseId, status, tablesRestored, recordsRestored, attachmentsRestored, errorMessage? }`
- **AND** the `status` enum SHALL be `'succeeded' | 'failed' | 'cancelled'`
