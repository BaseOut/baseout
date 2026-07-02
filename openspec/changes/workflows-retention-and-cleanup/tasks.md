# Implementation tasks

> **Implemented 2026-06-27** (paired with `server-retention-and-cleanup` A+B+C). The pre-req endpoint
> is `POST /api/internal/cleanup-plan` (engine decides + plans, Worker-safe) — the cron then deletes the
> storage objects in Node and POSTs `/api/internal/cleanup-complete` (engine soft-deletes the rows).
> The pure module takes **dep-injected** `fetchPlan` / `resolveWriter` / `postComplete` (cleaner than
> a raw `engineUrl`+`fetch` seam — no fetch-mocking needed). The original "engine runs the whole pass"
> framing was corrected: Workers can't reach R2, so the cron must do the deletion. See the server
> change's status block.

Pre-req: `server-retention-and-cleanup` Phase C (`/api/internal/cleanup-plan` + `/cleanup-complete`) is green. ✓

## 1. Trigger.dev scheduled task

- [x] 1.1 `apps/workflows/trigger/tasks/cleanup-expired-snapshots.task.ts` (wrapper, reads `BACKUP_ENGINE_URL`+`INTERNAL_TOKEN`, fetches the plan, deletes, posts completions) + `cleanup-expired-snapshots.ts` (pure, dep-injected).
- [x] 1.2 `schedules.task({ id: "cleanup-expired-snapshots", cron: "0 * * * *" })`; default `maxDuration` (600s).
- [x] 1.3 Type-only re-export added to `apps/workflows/trigger/tasks/index.ts`.
- [x] 1.4 `event: 'backup_cleanup_pass'` documented in the task header (the engine emits it on `cleanup-complete`).

## 2. Tests

- [x] 2.1 `apps/workflows/tests/cleanup-expired-snapshots.test.ts` (5 cases): all-ok; per-prefix failure → run `ok:false` + continues; empty-prefix metadata prune; empty plan → no `postComplete`; writer resolved per `storageType`. The wrapper's missing-env-var throw is smoke-covered (matches the delete-run-files wrapper, which is also pure-module-tested only).

## 3. Local smoke

- [ ] 3.1 `pnpm --filter @baseout/workflows dev` — connect to Trigger.dev cloud. Manually invoke the scheduled task via the Trigger.dev dashboard test runner.
- [ ] 3.2 Confirm the engine receives the pass-trigger call and emits the `event: 'backup_cleanup_pass'` log line on the server side.

## 4. Verification

- [x] 4.1 `pnpm --filter @baseout/workflows typecheck` (exit 0) + `... test` (cleanup sweep 5/5) — green.
- [x] 4.2 Server-side Phase C carries only the (now-resolved) `C.3.1` cross-ref; no duplicated bullets.
