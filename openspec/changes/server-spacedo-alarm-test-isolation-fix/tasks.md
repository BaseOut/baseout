# Tasks — server-spacedo-alarm-test-isolation-fix

## Phase A — Test rewrites + future-proof FIXED_NOW

All edits are in [apps/server/tests/integration/space-do.test.ts](../../../apps/server/tests/integration/space-do.test.ts). No production-code changes.

### A.1 — Restructure the 3 failing tests to single-block pattern

- [x] A.1.1 Test `SpaceDO POST /set-frequency > computes next-fire ... calls state.storage.setAlarm` — collapse both `runInDurableObject` blocks into one. Drive the action via `await inst.fetch(new Request("http://do/set-frequency", { method: "POST", body: ... }))` inside the block. Keep `inst.setSchedulerDepsForTests(...)` as the first statement in the block; keep the response-body assertions in-block; assert `state.storage.getAlarm()` against `computeNextFire("daily", FIXED_NOW)` as the last statement in the block.
- [x] A.1.2 Test `SpaceDO alarm() — happy path > inserts a scheduled run ...` — keep the existing first `runInDurableObject` block that calls `inst.setSchedulerDepsForTests(...)` + `await inst.alarm()`; **move** the `state.storage.getAlarm()` assertion (currently in a second block at the end of the test) into that same first block. Drop the second block.
- [x] A.1.3 Test `SpaceDO alarm() — error gates > reschedules but skips the fire when no active Airtable connection exists` — same merge as A.1.2.
- [x] A.1.4 Dep-mock assertions (`expect(deps.fetchConfig).toHaveBeenCalledOnce()` etc.) stay **outside** the `runInDurableObject` block — they read closure-captured `vi.fn()` references and don't depend on the DO isolate. Don't move them.

### A.2 — Bump FIXED_NOW to a future-proof date

- [x] A.2.1 Change `const FIXED_NOW = new Date("2026-05-12T14:23:00.000Z");` to `const FIXED_NOW = new Date("2030-01-15T14:23:00.000Z");`.
- [x] A.2.2 Add a leading comment explaining the workerd clamp behavior: "Far-future date so workerd doesn't clamp setAlarm(pastTimestamp)..." so the next reader sees why this isn't an arbitrary date.
- [x] A.2.3 Confirm all assertions referencing `computeNextFire("daily", FIXED_NOW)` self-update (they call the same constant + function on both expected and actual sides; bumping `FIXED_NOW` auto-propagates).

### A.3 — Phase A verification

- [x] A.3.1 `cd apps/server && pnpm exec vitest run tests/integration/space-do.test.ts --reporter=verbose` — all **9** tests green.
- [x] A.3.2 `cd apps/server && pnpm test` — full suite green: **31 files, 202 passing + 1 skipped, 0 failing**.
- [x] A.3.3 `cd apps/server && pnpm typecheck` — clean.
- [x] A.3.4 `cd apps/web && pnpm typecheck && pnpm exec vitest run` — clean / **425** passing (no spillover from the apps/server change).
- [ ] A.3.5 `git diff --staged | grep -nE '^\+.*(console\.|debugger)'` — no stray debug statements.
- [ ] A.3.6 Tick `B.7.1` in [openspec/changes/server-schedule-and-cancel/tasks.md](../server-schedule-and-cancel/tasks.md) once this lands — the Phase B verification gate now passes, unblocking the Phase B archive.
- [ ] A.3.7 On user approval: stage by name (`git add apps/server/tests/integration/space-do.test.ts openspec/changes/server-spacedo-alarm-test-isolation-fix/ openspec/changes/server-schedule-and-cancel/tasks.md`) + commit locally + push to `origin/autumn/server-setup`.
