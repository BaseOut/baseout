# Implementation tasks

## 1. AbortError handling

- [x] 1.1 `apps/workflows/trigger/tasks/backup-base.task.ts` outer try/catch surfaces unexpected throws (including `AbortError`) as `{ status: 'failed', errorMessage }` in the completion payload. Status mapping to `'cancelled'` happens on the engine side when the route handler matches the run row's `cancelling` state.
- [x] 1.2 `runBackupBase` finally block fires the `connections/:id/unlock` POST regardless of throw path.

## 2. Tests

- [x] 2.1 `apps/workflows/tests/backup-base-task-cancel.test.ts` — simulates abort mid-page, asserts unlock + complete-POST.

## 3. Verification

- [ ] 3.1 `pnpm --filter @baseout/workflows test` — green for the cancel test.
- [ ] 3.2 Cross-check: server-side `baseout-server-schedule-and-cancel` tasks list no longer carries the now-completed A.2.5 workflows test bullet; it's mirrored here.
