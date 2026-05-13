# Proposal — baseout-server-spacedo-alarm-test-isolation-fix

## Why

Commit `6d887a6` (chore: batch-ship Phase B + theme + openspec proposals) landed Phase B of [baseout-backup-schedule-and-cancel](../baseout-backup-schedule-and-cancel/) with **3 known-red tests** in [apps/server/tests/integration/space-do.test.ts](../../../apps/server/tests/integration/space-do.test.ts):

| # | Test | What it asserts |
|---|---|---|
| 1 | `SpaceDO POST /set-frequency > computes next-fire via computeNextFire and calls state.storage.setAlarm` | After `POST /set-frequency`, `state.storage.getAlarm()` equals `computeNextFire("daily", FIXED_NOW)`. |
| 2 | `SpaceDO alarm() — happy path > inserts a scheduled run, calls runStart, recomputes alarm, writes next_scheduled_at` | After `alarm()`, the re-armed alarm is readable from storage. |
| 3 | `SpaceDO alarm() — error gates > reschedules but skips the fire when no active Airtable connection exists` | The no-connection branch still re-arms the alarm. |

All three fail with `expected null to be <some-timestamp>`. They block the Phase B verification gate [`B.7.1`](../baseout-backup-schedule-and-cancel/tasks.md) (`pnpm --filter @baseout/server test — all green`) and any future CI gate on this branch — and they keep [baseout-backup-schedule-and-cancel](../baseout-backup-schedule-and-cancel/) from being archived.

Two distinct bugs in the **tests** (the SpaceDO production code is correct — `state.storage.setAlarm` is called at both [SpaceDO.ts:194](../../../apps/server/src/durable-objects/SpaceDO.ts) and [SpaceDO.ts:168](../../../apps/server/src/durable-objects/SpaceDO.ts)):

1. **Isolation boundary.** Each test used a split pattern: `runInDurableObject` to inject deps, then `stub.fetch(...)` (or `inst.alarm()`) to drive the action, then a **second** `runInDurableObject` to read `state.storage.getAlarm()`. Under `@cloudflare/vitest-pool-workers` v0.14.9, the second `runInDurableObject` callback gets a storage snapshot that does not reflect writes from `stub.fetch(...)` (and from `inst.alarm()` in a prior callback). The alarm read returns `null`.
2. **Date bitrot.** `FIXED_NOW = "2026-05-12T14:23:00.000Z"` is **in the past** relative to today's wall clock. `computeNextFire("daily", FIXED_NOW)` returns midnight UTC of 2026-05-13 — also in the past. `state.storage.setAlarm(pastTimestamp)` clamps to "fire ASAP," so `getAlarm()` returns approximately the current `Date.now()`, not the asserted boundary.

The isolation bug was the visible failure mode; fixing it alone exposed the date bitrot underneath. Both fixes are required for green.

## What Changes

Test-only. Zero changes to [SpaceDO.ts](../../../apps/server/src/durable-objects/SpaceDO.ts).

### Single-isolate restructure (the three failing tests)

- **Test 1 (`POST /set-frequency`)** — Move the action inside the same `runInDurableObject` block as the storage read. Invoke the HTTP handler via `await inst.fetch(new Request(...))` rather than `stub.fetch(...)` so `inst`, `state`, and the storage write all share one isolate.
- **Tests 2 + 3 (`alarm()`)** — Move the `await state.storage.getAlarm()` assertion **into** the existing `runInDurableObject` block that already calls `await inst.alarm()`. Drop the second block.

Dependency-mock assertions (`expect(deps.fetchConfig).toHaveBeenCalledOnce()` etc.) remain outside the block — they read closure-captured `vi.fn()` references and don't depend on the DO isolate.

### Future-proof `FIXED_NOW`

Bump the module-level `FIXED_NOW` from `2026-05-12T14:23:00.000Z` to `2030-01-15T14:23:00.000Z`. Add a leading comment naming the failure mode (workerd clamps `setAlarm(past)` to "fire ASAP") so the next reader sees why this isn't an arbitrary date.

## Out of Scope

- No production-code change to SpaceDO. Option B from the plan (a new `setFrequencyForTests` public seam) was prepared as a fallback but not needed — Option A worked.
- No fork or version bump of `@cloudflare/vitest-pool-workers`. The single-block pattern is the canonical workaround for the isolation contract.
- No `now()` injection refactor. Production `productionDeps(env).now` still returns `new Date()`; this proposal only changes what `FIXED_NOW` is set to in the test file.
- No spec edit under `openspec/specs/` — the external contract (frequency → alarm armed) is unchanged.

## Capabilities

No new capability. Touches existing `backup-scheduling` only at the test layer; no spec change required.

## Impact

- Unblocks Phase B archive for [baseout-backup-schedule-and-cancel](../baseout-backup-schedule-and-cancel/) (`B.7.1` flips green).
- Server test suite reaches `202 passing / 0 failing / 1 skipped` — the first fully-green run on `autumn/server-setup`.
- No effect on running systems, no migration, no deploy.

## Reversibility

Fully reversible — one `git revert` undoes both the test rewrites and the `FIXED_NOW` bump. No data state, no migration, no external API touched.
