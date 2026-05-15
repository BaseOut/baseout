## Why

Workflows-side counterpart to [`baseout-server-trial-quota-enforcement`](../baseout-server-trial-quota-enforcement/proposal.md). The server-side change owns the `trial-enforcement-gate` capability — quota state in the master DB, pre-enqueue gating in `/runs/start`, and the apps/web trial banner. This change owns the daily trial-email cron that sends "trial expiring in N days" notifications.

## What Changes

- New scheduled task `apps/workflows/trigger/tasks/trial-email-cron.task.ts`. Daily cron. Reads the engine's "orgs with trials expiring in {7, 3, 1, 0} days" list via engine-callback. For each row, POSTs a `trial-email-trigger` event to the server side. Mailgun call + template render live on the server.

## Out of Scope

- `trial-enforcement-gate` spec (pre-enqueue gating, runtime cap at 5 tables / 1000 records — that's the backup-base task's existing runtime behavior, separately covered by `trigger-task-runner`).
- `/api/internal/runs/start` 422 check on `trial_backup_run_used` — server-side.
- apps/web trial banner / countdown UI — apps/web change.
