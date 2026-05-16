## Why

The `ConnectionDO` per-Connection rate-limit gateway holds an in-memory lock during a backup-base run so concurrent runs against the same source Connection don't trample Airtable's 5 req/s budget. The lock is released in the `finally` block of `runBackupBase` (per `apps/workflows/trigger/tasks/backup-base.ts`) — but if the Trigger.dev task crashes mid-await before the unlock POST fires (e.g. process-level OOM, network partition between Trigger.dev and the engine), the DO holds a stale lock indefinitely.

Today, the DO's own alarm safety net releases the lock at `LOCK_TTL_MS`. That's fine for the immediate run, but it doesn't help in two scenarios:

1. **DO eviction**: if the DO evicts between the lock acquire and the alarm fire, the alarm is lost (workerd DO alarms persist across evictions, but rare edge cases — schema migrations, deploys — can drop them).
2. **Multi-DO leak**: across thousands of Spaces, a fraction of DOs will end up in a stale-lock state from the long tail of crash modes. The DO can't audit itself; an external sweeper has to.

This change adds a cron-driven lock manager that periodically asks each `ConnectionDO` to release any lock older than `LOCK_MAX_AGE_MINUTES` (default 30 min — well past the 10-minute Trigger.dev `maxDuration` cap, well short of the daily DO eviction interval).

## What Changes

- **Activate the connection-lock-manager cron** in `apps/server` every 15 minutes (`*/15 * * * *`). The Worker's `scheduled` handler dispatches the pass.
- **New module** `apps/server/src/lib/connection-lock-manager.ts`: pure-orchestration. `runConnectionLockManagerPass(deps)` enumerates Connections that the DO might hold a lock for (via a DB query against `connections` joined to currently-running `backup_runs` — narrows the sweep to live state), for each one calls `ConnectionDO.fetch(/lock/audit)` and the DO compares `now - lockedAt > LOCK_MAX_AGE` per its internal state, releasing on hit.
- **New ConnectionDO endpoint** `POST /lock/audit`: idempotent, INTERNAL_TOKEN-gated, returns `{ heldFor: number | null }` (null if no lock currently held; number = milliseconds the lock has been held). When called, the DO additionally checks the age threshold itself and releases if exceeded.
- **Activate the cron trigger** in `apps/server/wrangler.jsonc.example`.
- **Tests** under `apps/server/tests/integration/connection-lock-manager.test.ts`.

## Capabilities

### New Capabilities

- `connection-lock-manager`: 15-minute cron that audits ConnectionDOs for stale locks and releases them.

### Modified Capabilities

The `backup-engine` capability mentions per-Connection lock acquisition + alarm-driven release. This change adds an external safety net atop the alarm.

## Impact

- `apps/server/src/lib/connection-lock-manager.ts` — new pure module.
- `apps/server/src/durable-objects/ConnectionDO.ts` — new `/lock/audit` handler.
- `apps/server/wrangler.jsonc.example` — uncomment the cron line.
- `apps/server/tests/integration/connection-lock-manager.test.ts` — integration test.

## Out of Scope

- **Per-Space scheduler lock manager** (SpaceDO alarms) — SpaceDO holds different state and the DO's existing alarm covers its needs. The lock-manager pattern is Connection-specific.
- **Force-cancel of in-flight Trigger.dev runs** during audit — out of scope; the run might genuinely still be working. The audit only releases locks held past `LOCK_MAX_AGE_MINUTES`, which is well past any legitimate runtime.

## Cross-app contract

No cross-app contract beyond the existing INTERNAL_TOKEN-gated DO proxy. The audit endpoint is reachable by the Worker's `scheduled` handler only — never from `apps/web`, never from `apps/workflows`.
