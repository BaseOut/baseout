# baseout-server-spacedo-alarm-test-isolation-fix

Fixes 3 alarm-storage tests in [apps/server/tests/integration/space-do.test.ts](../../../apps/server/tests/integration/space-do.test.ts) that shipped red in commit `6d887a6` and were blocking the Phase B verification gate `B.7.1` (`pnpm --filter @baseout/server test — all green`) of [baseout-backup-schedule-and-cancel](../baseout-server-schedule-and-cancel/).

The SpaceDO production code was already correct — `state.storage.setAlarm(nextFireMs)` fires at both call sites. Two interacting bugs in the **test** caused the failure:

1. **Isolation:** the tests used a split-block pattern (`stub.fetch(...)` for the action, a separate `runInDurableObject(...)` for the read-back) that crosses an isolate boundary under `@cloudflare/vitest-pool-workers` — the alarm read-back gets `null`.
2. **Date bitrot:** `FIXED_NOW = "2026-05-12T14:23:00.000Z"` was in the past relative to today's wall clock (2026-05-13+), so `computeNextFire("daily", FIXED_NOW)` returned an already-past midnight. Workerd's `setAlarm(pastTimestamp)` clamps to "fire ASAP," and `getAlarm()` returns approximately-real-`Date.now()` instead of what the test asserted.

Fix is test-only — three test rewrites (single `runInDurableObject` block invoking `inst.fetch(new Request(...))` or `inst.alarm()` inline with the storage read) plus bumping `FIXED_NOW` to `2030-01-15T14:23:00.000Z` so the next-fire boundary stays in the future. No SpaceDO production changes.

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).
