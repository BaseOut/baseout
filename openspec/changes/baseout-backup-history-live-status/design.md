## Overview

Two independent defects keep BackupHistoryWidget's status chip from flipping without a full page refresh. Both ship in this change:

1. **The polling state machine self-suspends on all-terminal and the `backup-run-started` listener doesn't re-arm it** — the user-visible bug on the integrations page without any navigation. Fix: one extra `startPolling(spaceId, fetchRuns)` call inside the listener.
2. **The widget's `<script>` block runs once per browser session under `<ClientRouter />`** — a regression for any in-app navigation. Fix: move setup/teardown into `astro:page-load` / `astro:before-swap` handlers.

The second was diagnosed first and shipped first. Smoke testing surfaced the first, which this change subsequently addresses in the same openspec slot. The two fixes are independent and additive: each closes a real path to the symptom; together they cover both.

## Root cause #1 (Phase 2 — the user-reported bug): polling self-suspends, listener never re-arms

[`apps/web/src/stores/backup-runs.ts:77-92`](../../../apps/web/src/stores/backup-runs.ts#L77-L92) — the per-tick body of the chained `setTimeout`:

```ts
async function tick(): Promise<void> {
  if (token !== activeToken) return
  try {
    const runs = await fetchFn(spaceId)
    if (token !== activeToken) return
    setRuns(runs)
    if (allTerminal(runs)) {
      stopPolling()
      return
    }
  } catch { /* swallow */ }
  schedule()
}
```

`allTerminal([])` is `true` (vacuous quantification). `allTerminal([all_succeeded_history])` is `true`. So the loop self-suspends at +2s on the common "freshly-loaded page with no live runs" state.

When the user clicks **Run backup now**:

1. `POST /api/spaces/:id/backup-runs` → server returns runId.
2. `RunBackupButton` dispatches `backup-run-started`.
3. Pre-fix `widget-lifecycle.ts:80-84`:
   ```ts
   onBackupRunStarted = async () => {
     const fresh = await fetchRuns(spaceId)
     setRuns(fresh)
   }
   ```
   Runs one immediate fetch, calls `setRuns` with the new `running` row. The row appears in the DOM via the existing `$backupRuns.subscribe(render)` path.
4. **But polling stopped in step (1) of the page lifecycle.** The listener does NOT call `startPolling`. No further fetches go out. The engine eventually flips status to `succeeded` server-side. The browser never sees it until full page reload.

The fix is one line — append `startPolling(spaceId, fetchRuns)` to the listener body. `startPolling`'s first call is `stopPolling()`, so it's idempotent.

## Root cause #2 (Phase 1 — orthogonal regression for in-app navigation)

[`apps/web/src/layouts/Layout.astro:6`](../../../apps/web/src/layouts/Layout.astro#L6):

```ts
import { ClientRouter } from 'astro:transitions';
```

is rendered into the page `<head>`. Astro 5's ClientRouter swaps page bodies in place rather than doing a full document load, **which means `<script>` blocks declared in Astro components are evaluated exactly once for the lifetime of the browser session** — the next page swap reuses the already-evaluated module rather than re-running it.

The BackupHistoryWidget's existing `<script>` block ([`apps/web/src/components/backups/BackupHistoryWidget.astro:217-528`](../../../apps/web/src/components/backups/BackupHistoryWidget.astro#L217)) runs setup at module-top:

1. Hydrate from `<script data-backup-history-state>` JSON tag.
2. `$backupRuns.subscribe(render)`.
3. `startPolling(spaceId, fetchFn)`.
4. `window.addEventListener('backup-run-started', ...)`.
5. `document.addEventListener('astro:before-swap', () => stopPolling(), { once: true })`.

On the **first** page load this all works. On the **second** navigation to a widget-rendering page (whether the user navigated away and back, or visited `/integrations` after `/`), none of steps 1–4 re-run. The DOM has a freshly SSR'd widget; the JS does not know it exists.

Worse: the `{ once: true }` flag on the before-swap listener means after a single swap the cleanup is gone too. The very first page's `startPolling` timer was already cancelled by that one cleanup, but its `subscribe(render)` callback remains attached to the module-scoped `$backupRuns` atom — a benign-looking leak that quietly accumulates listeners across the rest of the session because nothing else removes them.

## Approach

**Use Astro's ClientRouter lifecycle events as the mount / unmount boundary.** This is the documented pattern for stateful client scripts under ClientRouter, and it requires zero changes to `$backupRuns`, `startPolling`, or the render function.

The new script shape ([apps/web/src/components/backups/BackupHistoryWidget.astro](../../../apps/web/src/components/backups/BackupHistoryWidget.astro)):

```ts
// Module-top code runs once per session — only declare functions / constants
// here. Do NOT call subscribe / startPolling at module top.
function setup() { /* hydrate + subscribe + startPolling */ }
function teardown() { /* unsubscribe + stopPolling + remove window listener */ }

let unsubscribe: (() => void) | null = null
let onBackupRunStarted: ((e: Event) => void) | null = null

// Fire on initial full-page load AND on every ClientRouter navigation.
document.addEventListener('astro:page-load', () => {
  if (document.querySelector('[data-backup-history]')) setup()
})

// Fire on every navigation away. Not `{ once: true }`.
document.addEventListener('astro:before-swap', teardown)
```

The `[data-backup-history]` gate inside `astro:page-load` makes setup a no-op on pages that don't render the widget (everywhere except `/`, `/integrations`).

The `setup` body:

1. Hydrate from `<script data-backup-history-state>` if present (same as today).
2. `unsubscribe = $backupRuns.subscribe(render)` — capture the unsubscribe callback nanostores returns.
3. Resolve `spaceId` from `[data-backup-history]`'s `data-space-id` attribute (same as today).
4. `startPolling(spaceId, fetchFn)`.
5. `onBackupRunStarted = async () => { ... }` then `window.addEventListener('backup-run-started', onBackupRunStarted)`.

The `teardown` body:

1. If `unsubscribe` is non-null → call it, then null out.
2. `stopPolling()` (idempotent — safe to call when nothing's running).
3. If `onBackupRunStarted` is non-null → `window.removeEventListener('backup-run-started', onBackupRunStarted)`, then null out.

Nothing else in the widget changes. SSR markup, JSON-state hydration tag, render function, `summaryInnerHtml` / `detailInnerHtml`, the `<details>` accordion in-place upsert — all stay identical.

## Sequence (after fix)

```
T=0     Full page load on /integrations
        → astro:page-load fires
        → setup() runs
        → polling active, store subscribed

T=4s    User clicks <a href="/"> (in-app navigation)
        → astro:before-swap fires
        → teardown() runs (unsubscribe + stopPolling + remove listener)
        → ClientRouter swaps DOM
        → astro:page-load fires (on /)
        → setup() runs again (widget exists on / too)
        → polling active, store subscribed

T=12s   User clicks Run backup now on /
        → POST /api/spaces/:id/backup-runs returns 200
        → RunBackupButton dispatches `backup-run-started`
        → onBackupRunStarted handler refreshes immediately
        → 2s polling continues afterward

T=60s   Engine finishes; runs/complete flips status to 'succeeded'
T=62s   Next poll tick returns status='succeeded'
        → render() updates the <li> in place; chip flips to green
```

Without the fix, the T=12s step never happens on a navigated page — RunBackupButton's CustomEvent fires but no listener is attached because module-top setup never re-ran.

## Concurrency / cleanup

- **Multiple subscribers risk**: today's bug also lets old `render` subscribers leak. The new teardown explicitly calls the unsubscribe callback nanostores returns, so the count of subscribers tracks page mounts 1:1.
- **Polling token already handles overlapping fetches**: [`startPolling`](../../../apps/web/src/stores/backup-runs.ts) increments an `activeToken` and cancels in-flight ticks from the prior poll. Our new `teardown → setup` sequence still ends with one active token; no change needed in the store.
- **Browser back / forward**: ClientRouter fires `astro:page-load` for both. Handled identically.
- **Pre-render cached pages**: `astro:page-load` also fires once on the initial full load (Astro guarantees this). So the `if (document.querySelector('[data-backup-history]')) setup()` check inside the handler is the single source of truth for "is the widget present?".

## Trade-offs

| Option | Pros | Cons | Choice |
|---|---|---|---|
| **`astro:page-load` + `astro:before-swap` lifecycle** | Idiomatic Astro 5 pattern. Surgical (no logic changes to store or render). Cleans up subscribers. | Slightly more code than `data-astro-rerun`. | **Chosen** |
| `data-astro-rerun` on the `<script>` tag | Single attribute, zero new code. | Re-runs module imports → re-subscribes the store. Each subscribe call leaks; the old subscriber still fires `render` against the new DOM (mostly OK, but counts of listeners climb with every navigation). Doesn't fix the silent leak. | Rejected |
| Move script to a framework island (React / Preact useEffect) | useEffect cleanup is canonical for this. | Bundle cost. Astro's `<ClientRouter />` event model is the lighter answer for a single widget. | Rejected |
| Switch to SSE / WebSocket | Real-time without polling. | Big infra change. Out of scope per proposal §Out of Scope. | Rejected (separate change) |

## Testing

Two layers of coverage, mirroring CLAUDE.md §3 and the existing widget spec pattern.

**1. Vitest (unit-ish) in `apps/web/src/components/backups/BackupHistoryWidget.spec.ts` (or the closest existing spec):**

- Synthesizes an `astro:page-load` `CustomEvent`, dispatches it on `document`, asserts:
  - `$backupRuns` has at least one subscriber (or the `setup` mock called subscribe).
  - `startPolling` was called with the right spaceId.
- Synthesizes `astro:before-swap`, asserts:
  - unsubscribe was called.
  - `stopPolling` was called.
  - The `backup-run-started` window listener was removed.
- Fires `astro:page-load` a second time, asserts another setup cycle ran cleanly (no double-subscribe).

These tests exercise the script's module exports if the imperative wiring is extracted into named functions, OR JSDOM-runs the actual script via a vitest `expectTypeOf`-style importer. Pick whichever fits the existing widget-test pattern.

**2. Playwright E2E in `apps/web/tests/e2e/backup-happy-path.spec.ts`:**

Extend the existing spec with one new scenario:

```ts
test('backup status flips after in-app navigation (regression)', async ({ page }) => {
  await page.goto('/integrations')
  await page.click('a[href="/"]')                  // in-app navigation
  await page.click('a[href="/integrations"]')      // navigate back to the widget-rendering page
  // From here, click Run backup now and assert the chip flips to 'Succeeded'
  // WITHOUT calling page.reload() anywhere. Timeout generous (≤60s)
  // because the backup itself takes that long; the *flip* should land
  // within ~4s after status changes server-side.
})
```

Uses the existing `seed-backup-happy-path.ts` test seed so the run completes deterministically.

**3. Manual smoke (human checkpoint):**

After the change lands locally:

1. `pnpm --filter @baseout/web dev` and `pnpm --filter @baseout/server dev`.
2. Browser to `/integrations`. Click an in-app link (e.g., another nav item), then back to `/integrations`.
3. Click "Run backup now". Watch the chip — should flip within ~4s of the engine completing without any manual refresh.
4. Open DevTools → Network → filter for `/backup-runs` → confirm the GET requests fire every 2s after the navigation (not just on initial load).

## What this design deliberately does NOT change

- The 2s polling interval (Phase 10d) stays.
- The in-place `<details>` upsert (Phase 10c) stays.
- The `$backupRuns` store API (`atom`, `setRuns`, `startPolling`, `stopPolling`, `isTerminalStatus`) stays.
- The GET / POST `/api/spaces/:spaceId/backup-runs` shape stays.
- `apps/server` runs/start, runs/complete, runs/progress all stay.
- RunBackupButton's `backup-run-started` CustomEvent dispatch stays.

Pure widget-script-lifecycle change.
