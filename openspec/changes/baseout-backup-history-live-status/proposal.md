## Why

Users running a backup expect the BackupHistoryWidget row's status chip to flip from `running` → `succeeded` (or `failed` / `trial_complete` / `trial_truncated`) without manual intervention. Today, that only happens on a full page refresh — when the user has navigated to the dashboard or `/integrations` from another in-app page, the chip stays frozen at its SSR-rendered status even though the engine has long since flipped the underlying `backup_runs.status` field and the polling endpoint correctly returns the new value.

The polling primitive (`startPolling` in [`src/stores/backup-runs.ts`](../../../apps/web/src/stores/backup-runs.ts)), the nanostore subscriber (`$backupRuns.subscribe(render)`), and the in-place upsert render (preserving each `<details>` row's `open` state) are all correctly implemented from Phase 10c + 10d. The defect is one layer up: the [`<script>`](../../../apps/web/src/components/backups/BackupHistoryWidget.astro) block that wires those primitives together only executes once per browser session, not once per page mount.

[`src/layouts/Layout.astro`](../../../apps/web/src/layouts/Layout.astro) imports `ClientRouter` from `astro:transitions` — Astro 5's persistent-router view-transitions API. With ClientRouter active, the framework swaps pages without a full reload, and inline `<script>` modules execute exactly once per session [per Astro's view-transitions docs](https://docs.astro.build/en/guides/view-transitions/#script-behavior-with-view-transitions). To run setup on every navigation, a script must either:

- set `data-astro-rerun` on the `<script>` tag, **or**
- listen for the `astro:page-load` lifecycle event and place its mount logic inside the handler.

The BackupHistoryWidget script does neither. Worse, its existing `astro:before-swap` cleanup uses `{ once: true }`, so after the first navigation the cleanup hook is gone too — the polling timer for the first page mount never gets cancelled and silently leaks across the rest of the session (no visible symptom because the widget's `render` falls through harmlessly when its DOM root isn't on the current page).

The symptom — "chip doesn't update unless I refresh" — is the visible half. The polling-timer leak is the silent half. Both go away with the same fix.

## What Changes

- **Move imperative setup into an `astro:page-load` handler** in [`apps/web/src/components/backups/BackupHistoryWidget.astro`](../../../apps/web/src/components/backups/BackupHistoryWidget.astro): JSON-script hydration, `$backupRuns.subscribe(render)`, `startPolling`, the `backup-run-started` event listener. The handler fires on initial full page load AND on every ClientRouter navigation, so polling resumes on every visit to a widget-rendering page.
- **Move cleanup into an `astro:before-swap` handler** without `{ once: true }`, and unbind everything the page-load handler registered: stop polling, unsubscribe from `$backupRuns`, remove the `backup-run-started` window listener. Re-registration on next page-load is clean.
- **Add an `astro:page-load`-aware test** to [`apps/web/tests/e2e/backup-happy-path.spec.ts`](../../../apps/web/tests/e2e/backup-happy-path.spec.ts): navigate `/integrations` → `/` → `/integrations`, kick off a backup, wait ≤4 seconds, assert the status chip flips to `succeeded` **without a page reload**. Pins the regression so it can't come back.
- **Add Vitest coverage** in [`apps/web/src/components/backups/BackupHistoryWidget.spec.ts`](../../../apps/web/src/components/backups/BackupHistoryWidget.spec.ts) (or extend the closest existing widget spec) that fires synthetic `astro:page-load` and `astro:before-swap` events at the script and asserts the subscribe / unsubscribe pair runs exactly once per mount.

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
