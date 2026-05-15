## ADDED Requirements

### Requirement: backup-base task handles cancellation cleanly
When the engine cancels a backup-base run via Trigger.dev's `runs.cancel`, the task body SHALL release the ConnectionDO lock and POST a structured failure to `/api/internal/runs/:runId/complete` before exiting.

#### Scenario: cancellation mid-page
- **WHEN** Trigger.dev injects an `AbortError` mid-await inside `runBackupBase`
- **THEN** the pure module's `finally` block SHALL fire `POST /api/internal/connections/:id/unlock`
- **AND** the wrapper's outer try/catch SHALL produce `{ status: 'failed', errorMessage: '<AbortError detail>' }`
- **AND** the wrapper SHALL POST `/api/internal/runs/:runId/complete` with that payload

#### Scenario: server-side route maps to 'cancelled'
- **WHEN** the `/runs/:runId/complete` route receives the failure shape and the run row's current status is `'cancelling'`
- **THEN** the route SHALL transition the row to `'cancelled'` (not `'failed'`)
- **AND** SHALL persist the per-base counts that the task gathered before the abort

#### Scenario: unlock errors are swallowed
- **WHEN** the unlock POST itself fails (network, 5xx)
- **THEN** the task SHALL NOT re-throw — the ConnectionDO lock alarm releases the lock at `LOCK_TTL_MS`
- **AND** SHALL still POST `/complete` so the run row can transition out of `running`
