## 1. Refactor the widget script to lifecycle-aware mount/unmount

- [ ] 1.1 In [apps/web/src/components/backups/BackupHistoryWidget.astro](../../../apps/web/src/components/backups/BackupHistoryWidget.astro), extract the imperative wiring (JSON-state hydration, `$backupRuns.subscribe(render)`, `startPolling(spaceId, fetchFn)`, `window.addEventListener('backup-run-started', …)`) into a single named function `setup(): void`. Module-top of the `<script>` block holds only function and constant declarations after this — no side effects.
- [ ] 1.2 Capture the cleanup handles `setup` returns. Two are needed: the unsubscribe callback nanostores returns from `subscribe(render)`, and the `backup-run-started` listener reference. Store both in module-scoped `let` variables (`unsubscribe: (() => void) | null`, `onBackupRunStarted: ((e: Event) => void) | null`).
- [ ] 1.3 Extract a corresponding `teardown(): void` that calls the unsubscribe handle, `stopPolling()`, and `window.removeEventListener('backup-run-started', onBackupRunStarted)` — each guarded so re-runs of teardown without a matching setup are no-ops. Null the handles after unbinding.
- [ ] 1.4 Replace the module-top setup call and the `{ once: true }` `astro:before-swap` listener with two ClientRouter lifecycle hooks at module-top:
  - `document.addEventListener('astro:page-load', () => { if (document.querySelector('[data-backup-history]')) setup() })`
  - `document.addEventListener('astro:before-swap', teardown)` — no `{ once: true }`.
- [ ] 1.5 Verify the stale comment at [`src/stores/backup-runs.ts:94`](../../../apps/web/src/stores/backup-runs.ts#L94) ("First tick lands at t+10s") doesn't need touching here — it's a comment-only inconsistency from the 10s→2s change in Phase 10d and is out of scope for this change (file a follow-up).

## 2. Vitest coverage for the lifecycle

- [ ] 2.1 Pick the closest existing widget spec file — `apps/web/src/components/backups/BackupHistoryWidget.spec.ts` if present; otherwise extend a sibling component spec — and add a `describe('astro:page-load lifecycle', ...)` block.
- [ ] 2.2 Test (red): "dispatching `astro:page-load` calls subscribe + startPolling exactly once". Mount the widget into a JSDOM document (mirror how existing widget specs do it), spy on `$backupRuns.subscribe` and on the polling module's `startPolling`. Dispatch a synthetic `CustomEvent('astro:page-load')` on `document`. Expect both spies called exactly once with the right args.
- [ ] 2.3 Test (red): "dispatching `astro:before-swap` calls unsubscribe + stopPolling and removes the window listener". Dispatch `astro:page-load` first to set up. Then dispatch `astro:before-swap`. Expect unsubscribe + stopPolling spies fired. Use `window.dispatchEvent(new CustomEvent('backup-run-started'))` AFTER teardown and assert the prior listener does NOT fire (count remains where it was).
- [ ] 2.4 Test (red): "two page-loads in a row do not double-subscribe". Dispatch `astro:page-load` → `astro:before-swap` → `astro:page-load`. Expect subscribe spy called exactly twice (once per setup), not three or more. Pins the no-leak invariant.
- [ ] 2.5 Watch all three fail (red). Implement Section 1. Watch green.
- [ ] 2.6 `pnpm --filter @baseout/web test:unit` — expect previous coverage + 3 new tests, all green. `pnpm --filter @baseout/web typecheck` — clean.

## 3. Playwright regression coverage

- [ ] 3.1 Extend [apps/web/tests/e2e/backup-happy-path.spec.ts](../../../apps/web/tests/e2e/backup-happy-path.spec.ts) with a new `test('backup status flips after in-app navigation', ...)`. Use the existing test-seed plumbing (the route at `apps/web/src/pages/api/internal/test/seed-backup-happy-path.ts`).
- [ ] 3.2 Test body: visit `/integrations`, in-app navigate to `/` and back to `/integrations` (use `page.click('a[href="…"]')`, NOT `page.goto` — `page.goto` triggers a full load and would mask the regression). Click "Run backup now". Wait for the row to appear with status='Running'. Assert `await expect(page.locator('[data-run-id]').first().getByText('Succeeded')).toBeVisible({ timeout: 70_000 })` **without** calling `page.reload()`.
- [ ] 3.3 Run via `pnpm --filter @baseout/web test:e2e -- backup-happy-path`. Expect previous scenarios + the new one green.

## 4. Human checkpoint (manual smoke)

- [ ] 4.1 `pnpm --filter @baseout/server dev` + `pnpm --filter @baseout/web dev`. Browser → `/integrations`. Navigate to `/` via an in-app link. Navigate back to `/integrations`. Click "Run backup now". Observe the chip flips to "Succeeded" within ~4 seconds of the engine finishing — **no manual refresh**.
- [ ] 4.2 DevTools → Network → filter for `/backup-runs` → confirm the GET requests fire every 2s after the navigation (not just on initial load). If they don't, polling isn't restarting.
- [ ] 4.3 Mobile responsive at 375 × 667. Same flow, no regression in layout.
- [ ] 4.4 On approval: stage exactly the changed files (`apps/web/src/components/backups/BackupHistoryWidget.astro`, the spec file extended in §2, the e2e spec extended in §3 — no `git add -A`). Local commit. **No push, no PR** per standing instructions.

## 5. Out of this change (follow-ups, file separately if needed)

- [ ] 5.1 Audit other `<script>` blocks under `apps/web/src/components/` for the same view-transition trap. RunBackupButton, FrequencyPicker, StoragePicker, and any nanostore-subscribed component are candidates.
- [ ] 5.2 Stale comment in `src/stores/backup-runs.ts:94` ("First tick lands at t+10s") should be "2s" — comment-only fix.
- [ ] 5.3 SSE / WebSocket upgrade per [`backups-mvp-realtime-progress-and-status-flip.md`](../../../../.claude/plans/backups-mvp-realtime-progress-and-status-flip.md) if 2s polling stops feeling crisp.
