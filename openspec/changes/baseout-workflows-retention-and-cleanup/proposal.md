## Why

Workflows-side counterpart to [`baseout-server-retention-and-cleanup`](../baseout-server-retention-and-cleanup/proposal.md). The server-side change owns the `runCleanupPass` orchestration, master-DB schema mirrors, the manual-cleanup HTTP route, and the apps/web UI. This change owns the Trigger.dev v3 scheduled task that invokes `runCleanupPass` on an hourly cron from `apps/workflows/`.

## What Changes

- New Trigger.dev v3 scheduled task `cleanup-expired-snapshots` defined in `apps/workflows/trigger/tasks/cleanup-expired-snapshots.task.ts`. Hourly cron (`0 * * * *`). Calls `runCleanupPass` (server-side pure function, called over `/api/internal` per the engine-callback contract — or imported directly if cleanup ends up running as part of the workflows runtime; the server-side proposal owns that decision).
- Register the task in `apps/workflows/trigger.config.ts` `tasks` (or rely on `dirs:` discovery — per project convention).
- Type-only re-export the task reference from `apps/workflows/trigger/tasks/index.ts` so the Cloudflare Worker can typed-trigger it if it ever needs a manual one-off invocation.
- Vitest unit test under `apps/workflows/tests/cleanup-expired-snapshots.test.ts` exercising the wrapper's env-var validation + fake-clock pass invocation.

## Out of Scope

- The `runCleanupPass` pure function itself — owned by the server-side sibling. Lives in `apps/server/src/lib/retention/run-cleanup-pass.ts`.
- The policy resolver `resolveRetentionPolicy` and the engine-side tier-cap helper — both in `apps/server/` and apps/web.
- The PATCH `/api/spaces/[spaceId]/retention-policy` route, the manual-cleanup `/api/internal/spaces/[spaceId]/cleanup` route, and the settings UI.
- The `backup_retention_policies` master DB migration + apps/server schema mirror.
- The default-policy backfill script `bootstrap-retention-policies.mjs` — server-side.

## Cross-app contract

The cron task posts no progress events; cleanup is short-lived and runs synchronously inside the task body. On task failure (R2 error, DB connectivity, etc.) the Trigger.dev runner's retry policy applies per `trigger.config.ts`. The structured log line `event: 'backup_cleanup_pass'` is emitted from the pure function on the server side and forwarded via the engine-callback contract; no separate `/complete` POST is needed because the cron pass has no per-run row to update.
