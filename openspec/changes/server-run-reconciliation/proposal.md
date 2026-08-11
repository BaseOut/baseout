# server-run-reconciliation — Proposal

## Why

A `backup_runs` row is stranded in `status='running'` forever whenever its fanned-out Trigger.dev tasks die without POSTing `/complete` — observed live 2026-07-14: with no local dev worker connected, all three tasks hit Trigger.dev's queue TTL and EXPIRED silently, and the run showed "running" in the UI indefinitely (the incident the owner reported as "you broke backups"). The task wrapper's `postCompletion` is deliberately fire-and-forget, and the code has referenced "Phase 11 reconciliation" as the planned safety net since the Backups MVP (see the comments in `apps/workflows/trigger/tasks/backup-base.task.ts` and `apps/server/src/lib/runs/start.ts`) — it was never built. The same gap applies to `restore_runs` (the restore lifecycle mirrors backup file-for-file per apps/server/CLAUDE.md).

## What Changes

- A **reconciliation sweep** on the engine's existing cron: find `backup_runs` (and `restore_runs`) in `queued`/`running` older than a grace window, look up each `trigger_run_ids` entry via the Trigger.dev API, and when EVERY task is terminal (COMPLETED without a recorded completion, EXPIRED, CANCELED, CRASHED, SYSTEM_FAILURE) mark the run `failed` with a structured `error_message` (e.g. `reconciled: tasks expired (no worker connected?)`), stamping `completed_at`.
- Runs whose tasks are still QUEUED/EXECUTING are left alone — the sweep only terminalizes runs that provably cannot complete.
- Pure decision function (`decideReconciliation(run, taskStates, now)`) with the Trigger.dev lookup and DB writes injected, per the house runs-lifecycle pattern (`processRunStart`/`processRunComplete`).
- Structured log line per sweep (scanned / reconciled / skipped counts) so a recurring stuck-run pattern is visible.

## Capabilities

### New Capabilities

- `run-reconciliation`: cron sweep that terminalizes backup/restore runs whose Trigger.dev tasks all reached a terminal state without reporting completion, so no run can sit in `running` forever.

### Modified Capabilities

None — `/complete` remains authoritative when it arrives first; the sweep is a backstop and must be idempotent against late completions.

## Impact

- **App:** `apps/server` only — new `src/lib/runs/reconcile.ts` (pure) + Trigger.dev status lookup helper + wiring into the existing `scheduled()` handler; no schema change (uses existing `trigger_run_ids`, `status`, `error_message`, `completed_at`).
- **Known quirk to resolve while building:** `trigger_run_ids` was observed empty (`[]`) on a completed run during the 2026-07-14 incident — determine what clears it (run-complete? cancel?) and pin the behavior with a test, since the sweep depends on the ids surviving for non-terminal rows.
- **No new secrets** — reuses `TRIGGER_SECRET_KEY` already held by the engine.
- **Risk:** double-terminalization race with a late `/complete` → the sweep's UPDATE is guarded on `status IN ('queued','running')`, same claim pattern as run-complete.
