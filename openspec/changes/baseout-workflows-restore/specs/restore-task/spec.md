## ADDED Requirements

### Requirement: Workflows-side restore-base Trigger.dev task
A Trigger.dev v3 task `restore-base` SHALL live in `apps/workflows/trigger/tasks/restore-base.task.ts` and execute one base's restore work: read CSV(s) from the storage destination, transform back to Airtable record shape, batch-create against Airtable, and POST progress + completion to apps/server.

#### Scenario: happy path
- **WHEN** apps/server enqueues `restore-base` with `{ restoreId, connectionId, sourceRunId, atBaseId, scope, scope_target, isTrial, encryptedToken, orgSlug, spaceName, baseName, restoreStartedAt }`
- **THEN** the task SHALL acquire the ConnectionDO lock via `/api/internal/connections/:id/lock`
- **AND** SHALL fetch the decrypted access token via `/api/internal/connections/:id/token`
- **AND** SHALL read CSV(s) for the in-scope table(s) via the active `StorageReader`
- **AND** SHALL batch-create records (10 per request) against `https://api.airtable.com/v0/:targetBaseId/:tableId`
- **AND** SHALL POST `/api/internal/restores/:restoreId/progress` after each table completes
- **AND** SHALL POST `/api/internal/restores/:restoreId/complete` at the end with the per-base counts

#### Scenario: lock contention with retry
- **WHEN** the lock acquire returns 409 (held by another run on the same Connection)
- **THEN** the task SHALL retry every 5 seconds for up to 60 seconds
- **AND** SHALL fail with `errorMessage: 'lock_unavailable'` if the retry budget expires

#### Scenario: rate-limit backoff
- **WHEN** Airtable returns 429 from the batch-create endpoint
- **THEN** the task SHALL honor the `Retry-After` header (or default to 30 seconds)
- **AND** SHALL retry the same batch
- **AND** SHALL NOT skip records

#### Scenario: partial table failure surfaces in completion
- **WHEN** Airtable returns 422 for a batch (e.g. invalid field value)
- **THEN** the task SHALL emit `errorMessage: 'airtable_422: <upstream>'` in the completion payload
- **AND** the partial `recordsRestored` count up to the failing batch SHALL be persisted

#### Scenario: AbortError mid-restore
- **WHEN** apps/server cancels the restore mid-batch via `tasks.runs.cancel`
- **THEN** the task body's outer try/catch SHALL produce `{ status: 'failed', errorMessage: <abort detail> }`
- **AND** the wrapper SHALL still POST `/complete` so the server's `cancelling → cancelled` transition fires
- **AND** the `finally` block SHALL release the ConnectionDO lock

### Requirement: Pure module is unit-testable independent of Trigger.dev
The restore orchestration SHALL be implemented as a pure async function `runRestoreBase(input, deps)` in `apps/workflows/trigger/tasks/restore-base.ts`. The wrapper task SHALL be the only file in the pair that imports `@trigger.dev/sdk`. Tests SHALL exercise the pure module by injecting `fetch`, `sleep`, storage-reader, csv-reader, airtable-create, and post-progress test seams via the `deps` object.

#### Scenario: tests target the pure module
- **WHEN** an integration test exercises `runRestoreBase`
- **THEN** it SHALL inject all external dependencies via `deps`
- **AND** SHALL NOT import the wrapper or `@trigger.dev/sdk`
- **AND** SHALL run under plain Vitest (Node environment)

### Requirement: Type-only re-export for the Worker
The task reference SHALL be re-exported as `export type` from `apps/workflows/trigger/tasks/index.ts` so apps/server can declare `tasks.trigger<typeof restoreBaseTask>("restore-base", payload)` without bundling the task body or its transitive dependencies (papaparse, node:fs).

#### Scenario: barrel export
- **WHEN** `apps/workflows/trigger/tasks/index.ts` is read
- **THEN** it SHALL include `export type { restoreBaseTask, RestoreBaseTaskPayload } from "./restore-base.task"`
- **AND** it SHALL include `export type { RestoreBaseResult, RestoreBaseInput } from "./restore-base"`
