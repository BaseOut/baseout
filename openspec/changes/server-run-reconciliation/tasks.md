# Tasks

## 1. Ground truth

- [ ] 1.1 Pin the `trigger_run_ids` lifecycle: reproduce the 2026-07-14 observation of `[]` on a completed run, find what clears it, and add a regression test asserting the ids survive while the run is non-terminal (the sweep depends on this).
- [ ] 1.2 Confirm the Trigger.dev v3 run-status vocabulary the engine can see via `GET /api/v3/runs/:id` (QUEUED, EXECUTING, COMPLETED, EXPIRED, CANCELED, CRASHED, SYSTEM_FAILURE, …) and record the terminal set in the module header.

## 2. Pure decision + lookup — TDD

- [ ] 2.1 RED: tests for `decideReconciliation(run, taskStates, now)` — all-expired → failed(reason); mixed executing → leave; all completed but run non-terminal (missed /complete) → failed(missed_completion); empty `trigger_run_ids` on a started run → failed(no_tasks_recorded) after a longer window; inside grace window → leave.
- [ ] 2.2 GREEN: `src/lib/runs/reconcile.ts` (pure, deps injected per the runs-lifecycle pattern).
- [ ] 2.3 Trigger.dev status lookup helper with per-run error tolerance (a 404/API error on one id must not abort the sweep; treat as unknown → leave the run alone this pass).

## 3. Cron wiring

- [ ] 3.1 Wire the sweep into the engine's existing `scheduled()` handler; guarded UPDATE (`status IN ('queued','running')`); cover `restore_runs` with the same pure function.
- [ ] 3.2 Structured sweep log line (scanned/reconciled/skipped) via the project logger pattern.
- [ ] 3.3 Tests: guarded-update race (late /complete), restore mirror path.

## 4. Verification

- [ ] 4.1 typecheck + targeted suites green.
- [ ] 4.2 Dev drill: stop the local Trigger worker, run a backup, wait past TTL + grace, confirm the run flips to `failed` with the expiry reason on the next cron firing — the exact 2026-07-14 incident, now self-healing.
