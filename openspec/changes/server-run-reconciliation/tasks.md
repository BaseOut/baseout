# Tasks

## 1. Ground truth

- [x] 1.1 Pin the `trigger_run_ids` lifecycle: → RESOLVED, by design: /complete REMOVES each id (jsonb `-` / array_remove) as its per-base completion lands and finalizes at [] — the column is a PENDING set, so `[]` on a completed run is normal and a stuck run retains exactly the never-completed ids. Consequence adopted: `[]`+running past grace = finalize-crash → recover final status from sticky error_message; `[]`+queued (restore_runs DEFAULTS to '{}') = no-tasks path, never finalize-succeeded. Pinned in runs-reconcile.test.ts. Original task: pin the lifecycle: reproduce the 2026-07-14 observation of `[]` on a completed run, find what clears it, and add a regression test asserting the ids survive while the run is non-terminal (the sweep depends on this).
- [x] 1.2 Confirm the Trigger.dev v3 run-status vocabulary — terminal set recorded in reconcile.ts header (COMPLETED/CANCELED/FAILED/CRASHED/SYSTEM_FAILURE/EXPIRED/TIMED_OUT/INTERRUPTED); unrecognized statuses treated as ACTIVE so a future status can never false-terminalize. Confirm the Trigger.dev v3 run-status vocabulary the engine can see via `GET /api/v3/runs/:id` (QUEUED, EXECUTING, COMPLETED, EXPIRED, CANCELED, CRASHED, SYSTEM_FAILURE, …) and record the terminal set in the module header.

## 2. Pure decision + lookup — TDD

- [x] 2.1 RED: tests for `decideReconciliation(run, taskStates, now)` — all-expired → failed(reason); mixed executing → leave; all completed but run non-terminal (missed /complete) → failed(missed_completion); empty `trigger_run_ids` on a started run → failed(no_tasks_recorded) after a longer window; inside grace window → leave.
- [x] 2.2 GREEN: `src/lib/runs/reconcile.ts` (pure, deps injected per the runs-lifecycle pattern).
- [x] 2.3 Trigger.dev status lookup helper (in reconcile-deps.ts; per-id try/catch → null → run left alone this pass). Trigger.dev status lookup helper with per-run error tolerance (a 404/API error on one id must not abort the sweep; treat as unknown → leave the run alone this pass).

## 3. Cron wiring

- [x] 3.1 Wired via the cron dispatch router (same */15 firing as the oauth sweep); guarded UPDATE (`status IN ('queued','running')` + RETURNING) in reconcile-deps.ts; restore mirror covered by the same pure function (both mirrors gained `createdAt`, header-commented). Wire the sweep; guarded UPDATE (`status IN ('queued','running')`); cover `restore_runs` with the same pure function.
- [x] 3.2 Structured sweep log line (scanned/reconciled/skipped) via the project logger pattern.
- [x] 3.3 Tests: guarded-update race (raceLost path), restore mirror path, per-run error isolation — 19 tests in runs-reconcile.test.ts.

## 4. Verification

- [x] 4.1 typecheck + targeted suites green (tsc clean; 70 tests across reconcile, cron-dispatch, runs-complete/start, restores-complete).
- [x] 4.2 Dev drill PASSED 2026-07-15: worker stopped, run 92389ff6 stranded with 3 tasks; tasks EXPIRED at the 10-min TTL; the 02:30Z firing correctly LEFT it (grace until 02:31:55); the 02:45:12Z firing flipped it to `failed` / `reconciled: tasks terminal without completion (EXPIRED x3)` — the exact 2026-07-14 incident, now self-healing within one cron cycle.
