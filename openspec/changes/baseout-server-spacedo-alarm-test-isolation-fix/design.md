# Design — baseout-server-spacedo-alarm-test-isolation-fix

## Overview

Two diagnoses, one combined fix in [apps/server/tests/integration/space-do.test.ts](../../../apps/server/tests/integration/space-do.test.ts). Production code at [apps/server/src/durable-objects/SpaceDO.ts](../../../apps/server/src/durable-objects/SpaceDO.ts) stays untouched.

## Phase A.1 — The `runInDurableObject` isolation contract

### How the harness behaves

`runInDurableObject(stub, callback)` from `cloudflare:test` (provided by `@cloudflare/vitest-pool-workers` v0.14.9) "temporarily replaces your Durable Object's `fetch()` handler with `callback`, then sends a request to it." The callback receives `(inst, state)` — the live DO instance and its storage state.

Empirically, when a test uses the **split pattern**:

```ts
// Block 1: inject deps
await runInDurableObject(stub, async (inst) => { inst.setSchedulerDepsForTests(...); });
// Action: drive via stub.fetch (different context)
const res = await stub.fetch("http://do/set-frequency", { ... });
// Block 2: read storage
await runInDurableObject(stub, async (_inst, state) => {
  await state.storage.getAlarm(); // returns null
});
```

the second block's `state.storage` does not observe writes from the action. Block 2's `state` is a snapshot taken at block-entry that misses the alarm write performed during step 2.

### The single-block pattern

Drive the action **inside** the same `runInDurableObject` block where the read-back lives:

```ts
await runInDurableObject(stub, async (inst, state) => {
  inst.setSchedulerDepsForTests(...);
  await inst.fetch(new Request("http://do/set-frequency", { ... }));
  // OR: await inst.alarm();
  const next = await state.storage.getAlarm();
  expect(next).toBe(computeNextFire("daily", FIXED_NOW));
});
```

`inst.fetch(new Request(...))` invokes the DO instance's HTTP handler in-place — `this` resolves to `inst`, so `this.deps` set by an earlier line in the same block is honored. `state` is the live storage handle for that same instance, and the alarm write propagates to it within the block's lifetime.

### Precedent

[apps/server/tests/integration/connection-do-token-cache.test.ts](../../../apps/server/tests/integration/connection-do-token-cache.test.ts) uses the same harness successfully but avoids the issue because its assertions read **in-instance memory** (`tokenCache` Map on `inst`) rather than `state.storage`. Cross-block in-instance state survives `stub.fetch(...)` because the same DO instance is addressed by name. Cross-block storage reads do not survive — `state.storage` snapshots per `runInDurableObject` entry.

## Phase A.2 — `FIXED_NOW` date bitrot

### How it manifested

`FIXED_NOW = "2026-05-12T14:23:00.000Z"` was a future date when the test was originally written. Wall-clock time advanced past it. By 2026-05-13, `computeNextFire("daily", FIXED_NOW)` returned `2026-05-13T00:00:00Z` — also in the past relative to real time.

Workerd's `state.storage.setAlarm(pastTimestamp)` clamps the alarm to "fire as soon as possible." `state.storage.getAlarm()` then returns approximately `Date.now()` (around `1778701255799` during the failing run), not the asserted boundary (`1778630400000`).

The two bugs were entangled: while the isolation bug masked the storage read (returning `null`), the date-bitrot bug never surfaced. Fixing isolation flipped the failure mode from `null vs 1778630400000` to `1778701255799 vs 1778630400000`, exposing the second bug.

### The future-proof fix

`FIXED_NOW = new Date("2030-01-15T14:23:00.000Z")` keeps the computed next-fire boundary (`2030-01-16T00:00:00Z`) far enough in the future that no near-term real-time drift will push it past. A comment in the test file names the workerd clamp behavior so the next reader doesn't re-introduce a near-term date.

This is not a permanent fix — the next bitrot is in 2030. A more robust pattern is a date relative to `Date.now()` per-test (e.g., `new Date(Date.now() + 24 * 60 * 60 * 1000)`), but it introduces test-run variance and conflicts with the project's deterministic-FIXED_NOW convention. Out of scope here; revisit when 2030 approaches.

## Phase A.3 — Why not change SpaceDO

The plan ([~/.claude/plans/how-are-the-backups-harmonic-pebble.md](~/.claude/plans/how-are-the-backups-harmonic-pebble.md)) prepared an Option B fallback (a new `setFrequencyForTests` public method on SpaceDO) if the single-block pattern didn't fully work. The Option A canary (test 1 only) confirmed the pattern is sufficient — Option B is not needed.

This preserves the rule from [CLAUDE.md §3.2](../../../CLAUDE.md) — *don't refactor what works.* The SpaceDO impl correctly calls `state.storage.setAlarm` at [:194](../../../apps/server/src/durable-objects/SpaceDO.ts) and [:168](../../../apps/server/src/durable-objects/SpaceDO.ts); growing its test-seam surface for a problem that's actually in the tests would be the wrong fix.
