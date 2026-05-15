## 1. Refactor the widget script to lifecycle-aware mount/unmount

- [x] 1.1 Extracted the imperative wiring into a separate testable module: [`apps/web/src/lib/backups/widget-lifecycle.ts`](../../../apps/web/src/lib/backups/widget-lifecycle.ts) exports `setupBackupHistory(opts)`, `teardownBackupHistory(handles)`, and `registerBackupHistoryLifecycle(opts)`. Departed from the task's literal "extract into a function inside the script block" wording: a sibling .ts file is the minimum viable shape for Vitest to import the lifecycle directly (Vitest can't load .astro `<script>` blocks). Same semantic — the widget's module-top now only declares functions / constants.
- [x] 1.2 Cleanup handles captured by `SetupHandles { unsubscribe, onBackupRunStarted }`. Returned from `setupBackupHistory` and consumed by `teardownBackupHistory`. Module-scope `let handles` lives inside `registerBackupHistoryLifecycle`.
- [x] 1.3 `teardownBackupHistory(handles)` calls the unsubscribe handle, `stopPolling()`, and removes the `backup-run-started` window listener — all guarded with `if (!handles) return` so re-runs are no-ops.
- [x] 1.4 `registerBackupHistoryLifecycle` registers both `astro:page-load` and `astro:before-swap` listeners. The page-load handler does a safety teardown BEFORE setting up, so multi-mount-without-swap edge cases land cleanly. Widget script ([apps/web/src/components/backups/BackupHistoryWidget.astro](../../../apps/web/src/components/backups/BackupHistoryWidget.astro)) now reduces to `registerBackupHistoryLifecycle({ render })`.
- [x] 1.5 Stale `src/stores/backup-runs.ts:94` comment left untouched (logged as 5.2 follow-up).

## 2. Vitest coverage for the lifecycle

- [x] 2.1 No existing widget specs found under `apps/web/src/components/backups/`. Per the task's "or extend a sibling component spec" branch, created a new sibling spec next to the extracted module: [`apps/web/src/lib/backups/widget-lifecycle.test.ts`](../../../apps/web/src/lib/backups/widget-lifecycle.test.ts). Uses `// @vitest-environment happy-dom` (matches the project's pattern in `src/lib/ui.test.ts`).
- [x] 2.2 "dispatching `astro:page-load` subscribes + starts polling for the widget spaceId" — green. Asserts the render dep is invoked with the initial store value (nanostores delivers it synchronously), and the injected `fetchRuns` fires when the `backup-run-started` window event is dispatched.
- [x] 2.3 "dispatching `astro:before-swap` unsubscribes + stops polling + removes window listener" — green. After teardown, both `setRuns([…])` and `window.dispatchEvent('backup-run-started')` are observably no-op for the prior render/fetchRuns spies.
- [x] 2.4 "two page-loads in a row mount cleanly without double-subscribing" — green. Two consecutive `astro:page-load` events (no intervening before-swap) trigger the safety teardown inside the page-load handler, leaving exactly one active subscriber.
- [x] 2.5 Bonus 4th test: "no-ops when the widget is absent from the page (predicate fails)" — pins the conditional setup so widget-less pages don't fire subscribe/poll.
- [x] 2.6 `pnpm --filter @baseout/web test:unit` → **29 files / 357 passed** (was 353 before; +4 from this spec). `pnpm --filter @baseout/web typecheck` → 0 errors, 0 warnings, 4 hints (all pre-existing).

## 3. Playwright regression coverage

- [x] 3.1 Added a new `test('backup history polling resumes after in-app navigation', …)` in [apps/web/tests/e2e/backup-happy-path.spec.ts](../../../apps/web/tests/e2e/backup-happy-path.spec.ts). Reuses the existing `seedBackupHappyPath` + `pollMagicLink` helpers.
- [x] 3.2 Reshaped the assertion from "wait for chip to flip to Succeeded" → "count `/backup-runs?` GET requests fire after navigation". Reason: the existing test file already documents that asserting `succeeded` requires an apps/server `E2E_TEST_MODE` short-circuit that doesn't exist yet (the inline-Trigger.dev path against stub Airtable + stub R2). Counting polls directly verifies the regression's underlying signal — "did the polling timer resume on the navigated-back page?" — without depending on backup completion.
- [ ] 3.3 The user runs `pnpm --filter @baseout/web test:e2e backup-happy-path` against `E2E_TARGET_URL` / `E2E_TEST_TOKEN`. **Not run from here** — Playwright e2e runs require those env vars set and a live deployed worker target.

## 4. Human checkpoint (manual smoke)

- [ ] 4.1 `pnpm --filter @baseout/server dev` + `pnpm --filter @baseout/web dev`. Browser → `/integrations`. Navigate to `/` via an in-app link. Navigate back to `/integrations`. Click "Run backup now". Observe the chip flips to "Succeeded" within ~4 seconds of the engine finishing — **no manual refresh**.
- [ ] 4.2 DevTools → Network → filter for `/backup-runs` → confirm the GET requests fire every 2s after the navigation (not just on initial load). If they don't, polling isn't restarting.
- [ ] 4.3 Mobile responsive at 375 × 667. Same flow, no regression in layout.
- [ ] 4.4 On approval: stage exactly the changed files (`apps/web/src/components/backups/BackupHistoryWidget.astro`, the spec file extended in §2, the e2e spec extended in §3 — no `git add -A`). Local commit. **No push, no PR** per standing instructions.

## 6. Phase 2 — listener re-arms polling (the user-reported bug)

Smoke testing the Phase 1 fix surfaced that the chip STILL didn't flip without a refresh on `/integrations`, even on the page the whole time (no navigation). Root cause was a separate defect in the polling state machine: the loop self-suspends on `allTerminal` (common case: only-historical-succeeded runs OR empty store), and the `backup-run-started` listener fired only an immediate refresh — never re-arming the loop. So the new `running` row appeared but its chip never updated.

- [x] 6.1 TDD red: new case `'backup-run-started re-arms polling after the loop self-suspends on all-terminal'` in [apps/web/src/lib/backups/widget-lifecycle.test.ts](../../../apps/web/src/lib/backups/widget-lifecycle.test.ts). Uses `vi.useFakeTimers()`. Drives: page-load → first poll tick returns `[]` (all-terminal) → loop suspends → verify silence for 5s → dispatch `backup-run-started` → assert `fetchRuns` count goes from 1 to 2 (immediate refresh) → advance 2.5s → assert count ≥ 3 (re-armed poll fired again). Watch FAIL.
- [x] 6.2 TDD green: append `startPolling(spaceId, fetchRuns)` to the existing `onBackupRunStarted` async handler in [apps/web/src/lib/backups/widget-lifecycle.ts](../../../apps/web/src/lib/backups/widget-lifecycle.ts) after the `setRuns(fresh)` call. Comment documents the all-terminal self-suspend → re-arm rationale. Watch GREEN.
- [x] 6.3 `pnpm --filter @baseout/web test:unit widget-lifecycle` → **5 passed** (4 + 1 new). `pnpm --filter @baseout/web test:unit` → **29 files / 358 passed** (up from 357). `pnpm --filter @baseout/web typecheck` → 0 errors, 0 warnings, 4 hints (pre-existing).
- [x] 6.4 Documented the diagnosis miss + real root cause in `proposal.md` (Why §, What Changes §) and `design.md` (Overview §, Root cause #1 §).
- [ ] 6.5 Human checkpoint: smoke against live dev, click Run backup now on `/integrations` without navigating — confirm the chip flips from `Running` → `Succeeded` within ~4s of engine completion, no page refresh. DevTools Network shows `/backup-runs?` GETs continuing every 2s after the click.

## 5. Out of this change (follow-ups, file separately if needed)

- [ ] 5.1 Audit other `<script>` blocks under `apps/web/src/components/` for the same view-transition trap. RunBackupButton, FrequencyPicker, StoragePicker, and any nanostore-subscribed component are candidates.
- [ ] 5.2 Stale comment in `src/stores/backup-runs.ts:94` ("First tick lands at t+10s") should be "2s" — comment-only fix.
- [ ] 5.3 SSE / WebSocket upgrade per [`backups-mvp-realtime-progress-and-status-flip.md`](../../../../.claude/plans/backups-mvp-realtime-progress-and-status-flip.md) if 2s polling stops feeling crisp.
