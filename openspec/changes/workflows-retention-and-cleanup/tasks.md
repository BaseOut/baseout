# Implementation tasks

Pre-req: server-side `server-retention-and-cleanup` Phase C.2 (`runCleanupPass` implemented + exposed via `/api/internal/spaces/cleanup-all` or equivalent) is green.

## 1. Trigger.dev scheduled task

- [ ] 1.1 New file `apps/workflows/trigger/tasks/cleanup-expired-snapshots.task.ts`. Pattern: pure-module + task wrapper per `workflows` `trigger-task-runner` spec. The wrapper reads `BACKUP_ENGINE_URL` + `INTERNAL_TOKEN` from `process.env`, then POSTs the engine's pass-trigger internal endpoint (per the engine-callback contract). The pure module is a thin async function that takes `engineUrl`, `internalToken`, and optionally a `fetch` impl injected.
- [ ] 1.2 Configure as a Trigger.dev v3 scheduled task with `cron: "0 * * * *"` (hourly). `maxDuration` stays at the project default (600s).
- [ ] 1.3 Add the type-only re-export to `apps/workflows/trigger/tasks/index.ts`.
- [ ] 1.4 Document the structured log event `event: 'backup_cleanup_pass'` expectation in the task header comment.

## 2. Tests

- [ ] 2.1 `apps/workflows/tests/cleanup-expired-snapshots.test.ts` — pure-module unit test. Cases: success path (engine returns 200), engine-error path (5xx — task should surface as a structured failure), missing env-var path (`BACKUP_ENGINE_URL` unset → wrapper throws with descriptive message). Inject `fetch` via deps.

## 3. Local smoke

- [ ] 3.1 `pnpm --filter @baseout/workflows dev` — connect to Trigger.dev cloud. Manually invoke the scheduled task via the Trigger.dev dashboard test runner.
- [ ] 3.2 Confirm the engine receives the pass-trigger call and emits the `event: 'backup_cleanup_pass'` log line on the server side.

## 4. Verification

- [ ] 4.1 `pnpm --filter @baseout/workflows typecheck && pnpm --filter @baseout/workflows test` — green.
- [ ] 4.2 Cross-check that the server-side `server-retention-and-cleanup` Phase C tasks no longer carry the duplicated `C.3.1`/`C.3.2`/`C.3.3` bullets (those moved here).
