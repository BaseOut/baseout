## Why

Workflows-side counterpart to [`server-schedule-and-cancel`](../server-schedule-and-cancel/proposal.md). The server-side change owns the per-Space SpaceDO alarm cadence, the manual `/runs/{id}/start` route, the `/runs/{id}/cancel` route, the run-row state machine, and the `cancelTriggerRun` SDK call. This change owns the `backup-base.task.ts` AbortError handling that ensures a cancelled run still releases the ConnectionDO lock and POSTs `/complete` with `status='cancelled'` (mapped from the AbortError surface).

## What Changes

- Confirm `apps/workflows/trigger/tasks/backup-base.task.ts`'s existing outer `try/catch` correctly surfaces an `AbortError` (the shape Trigger.dev's cancellation injects mid-await) as a structured failure with `status='cancelled'` in the completion payload.
- Vitest coverage: `apps/workflows/tests/backup-base-task-cancel.test.ts` — simulate cancellation mid-page, assert (a) `runBackupBase`'s `finally` fires the `connections/:id/unlock` POST, (b) the wrapper still POSTs `/runs/:id/complete` with the failure shape.

## Out of Scope

- The `/runs/{id}/cancel` route, `cancelTriggerRun` SDK call, `cancelling → cancelled` row transition — all server-side.
- SpaceDO alarm cadence, manual-trigger route, `/runs/{id}/start` handler — server-side.
- apps/web cancel button — apps/web change family.

## Status

The cancel test was already migrated as part of the workspace split (see `apps/workflows/tests/backup-base-task-cancel.test.ts`). This change documents the workflows-side contract that the test covers.
