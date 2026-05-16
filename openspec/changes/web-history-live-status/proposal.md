## Why

Users running a backup expect the BackupHistoryWidget row's status chip to flip from `running` → `succeeded` (or `failed` / `trial_complete` / `trial_truncated`) without manual intervention. Today, that only happens on a full page refresh.

**Two independent defects produce the same symptom.** The first round of this change addressed only one of them; the user reported the chip *still* didn't flip without a refresh on `/integrations`, surfacing the second. Both fixes ship in this change:

1. **Polling-state-machine defect (Phase 2 — the actual user-reported bug).** The poll loop at [`apps/web/src/stores/backup-runs.ts:77-92`](../../../apps/web/src/stores/backup-runs.ts#L77-L92) calls `if (allTerminal(runs)) { stopPolling(); return }` on every tick. On a page with only historical `succeeded` runs (the common case) or with no runs at all (the first-time case), the loop self-suspends at +2s. When the user clicks **Run backup now**, the widget's `backup-run-started` listener does a single immediate refresh but does **not** restart polling — so the new `running` row appears, but its chip never updates because the loop is dead. The engine flips the status to `succeeded` server-side; the browser has no live read path to discover it. Refresh → SSR delivers the now-terminal status → chip finally reads "Succeeded".

2. **ClientRouter script-lifecycle defect (Phase 1 — the original hypothesis).** The widget's `<script>` previously ran setup at module-top, which under Astro's `<ClientRouter />` (imported in [Layout.astro:6](../../../apps/web/src/layouts/Layout.astro#L6)) executes exactly once per browser session. After any in-app navigation the polling timer + `backup-run-started` listener never re-attached, so the chip stayed frozen on subsequent visits.

Defect 1 is the one the user hit on the integrations page without navigation. Defect 2 is the orthogonal regression that surfaced during the same investigation. Both are real; both ship in this change.

The polling primitive (`startPolling` in [`src/stores/backup-runs.ts`](../../../apps/web/src/stores/backup-runs.ts)), the nanostore subscriber (`$backupRuns.subscribe(render)`), and the in-place upsert render (preserving each `<details>` row's `open` state) are all correctly implemented from Phase 10c + 10d. The defect is one layer up: the [`<script>`](../../../apps/web/src/components/backups/BackupHistoryWidget.astro) block that wires those primitives together only executes once per browser session, not once per page mount.

[`src/layouts/Layout.astro`](../../../apps/web/src/layouts/Layout.astro) imports `ClientRouter` from `astro:transitions` — Astro 5's persistent-router view-transitions API. With ClientRouter active, the framework swaps pages without a full reload, and inline `<script>` modules execute exactly once per session [per Astro's view-transitions docs](https://docs.astro.build/en/guides/view-transitions/#script-behavior-with-view-transitions). To run setup on every navigation, a script must either:

- set `data-astro-rerun` on the `<script>` tag, **or**
- listen for the `astro:page-load` lifecycle event and place its mount logic inside the handler.

The BackupHistoryWidget script does neither. Worse, its existing `astro:before-swap` cleanup uses `{ once: true }`, so after the first navigation the cleanup hook is gone too — the polling timer for the first page mount never gets cancelled and silently leaks across the rest of the session (no visible symptom because the widget's `render` falls through harmlessly when its DOM root isn't on the current page).

The symptom — "chip doesn't update unless I refresh" — is the visible half. The polling-timer leak is the silent half. Both go away with the same fix.

## What Changes

**Phase 1 — ClientRouter script lifecycle** (already shipped earlier in this change):

- **Extract setup / teardown into a testable sibling module:** [`apps/web/src/lib/backups/widget-lifecycle.ts`](../../../apps/web/src/lib/backups/widget-lifecycle.ts) owns the JSON-script hydration, `$backupRuns.subscribe(render)`, `startPolling`, and the `backup-run-started` listener — all wrapped in `setupBackupHistory` + `teardownBackupHistory` + `registerBackupHistoryLifecycle`. The widget's `<script>` reduces to one `registerBackupHistoryLifecycle({ render })` call.
- **Wire `astro:page-load` + `astro:before-swap`** (no `{ once: true }`) so setup re-runs on every ClientRouter navigation and teardown cleans up cleanly.
- **Vitest coverage** in [`apps/web/src/lib/backups/widget-lifecycle.test.ts`](../../../apps/web/src/lib/backups/widget-lifecycle.test.ts): 4 tests covering page-load setup, before-swap teardown, double-mount safety, and widget-absent no-op.
- **Playwright regression** in [`apps/web/tests/e2e/backup-happy-path.spec.ts`](../../../apps/web/tests/e2e/backup-happy-path.spec.ts): counts `/backup-runs?` GET requests after in-app navigation `/integrations` → `/` → `/integrations` — verifies polling resumes without `page.reload()`.

**Phase 2 — listener re-arms polling** (this round, addressing the actual user-reported bug):

- **Re-arm polling in the `backup-run-started` listener** at [`widget-lifecycle.ts:80-84`](../../../apps/web/src/lib/backups/widget-lifecycle.ts#L80-L84). After the immediate `fetchRuns` + `setRuns(fresh)`, call `startPolling(spaceId, fetchRuns)`. `startPolling` is already idempotent — its first call is `stopPolling()` — so this is safe whether or not the loop was already suspended. Without this, the chip never flips on a fresh backup unless the loop happened to still be running for an unrelated reason.
- **Pin the regression with a Vitest case** in [`widget-lifecycle.test.ts`](../../../apps/web/src/lib/backups/widget-lifecycle.test.ts): uses `vi.useFakeTimers()`, drives the all-terminal self-suspend, dispatches `backup-run-started`, advances the fake clock past the next 2s tick, asserts `fetchRuns` is called from a poll tick (not just the listener's immediate refresh).

## Out of Scope

- **Switching from polling to SSE / WebSocket.** That's the documented upgrade path in [`backups-mvp-realtime-progress-and-status-flip.md`](../../../../.claude/plans/backups-mvp-realtime-progress-and-status-flip.md). Not needed to fix this regression; pursue separately when polling cadence becomes a scale problem.
- **Polling cadence changes.** Phase 10d's 2s interval stays. The chip-not-flipping symptom is not a cadence issue.
- **RunBackupButton, FrequencyPicker, StoragePicker, IntegrationsView**, or any other widget. The same `<script>` pattern likely exists in other components and may have similar latent issues, but each is its own follow-up — `apps/web/.claude/CLAUDE.md` §1.5 ("Don't refactor what works") applies. Only fix BackupHistoryWidget here; flag the pattern audit as a separate change.
- **Server-side changes.** `apps/server`'s runs/complete, runs/progress, and OAuth refresh paths are untouched.

## Capabilities

### Modified Capability

- `backup-history-live-updates` — the dashboard / integrations tile already polls `/api/spaces/:spaceId/backup-runs` every 2s and re-renders rows in place. This change makes that polling resilient to view-transition navigations so the chip flips on every page mount, not only on the very first one.

## Impact

- **Master DB schema**: no migration. No schema touched.
- **`apps/server`**: no contract change. The polling endpoint shape, runs/complete, and runs/progress all stay as-is.
- **`apps/web` other surfaces**: no contract change. The store API (`$backupRuns`, `setRuns`, `startPolling`, `stopPolling`) stays the same. Only the widget's own script wiring changes.
- **Performance**: each `astro:page-load` event triggers one `fetch` to `/api/spaces/:spaceId/backup-runs?limit=10` (the immediate refresh inside the new handler, optional — covered in design.md). At MVP scale this is rounding error against the existing 2s polling.
- **Accessibility**: unchanged. The visible chip update + `<details>` accordion state preservation behavior is identical.
- **Cross-app surface**: nothing. Pure `apps/web` widget script lifecycle.

## Reversibility

Pure roll-forward. To revert, restore the script to its pre-change shape (single top-level execution + `{ once: true }` cleanup). The widget would go back to broken-after-navigation behavior, but nothing else regresses. No new persistent state introduced.
