/**
 * Mount/unmount lifecycle for BackupHistoryWidget under Astro's ClientRouter.
 *
 * `<ClientRouter />` (imported in Layout.astro) keeps the document alive across
 * navigations, so inline <script> blocks evaluate exactly once per browser
 * session. Anything with side effects must run inside `astro:page-load` and
 * be torn down on `astro:before-swap` — otherwise polling/subscribe wiring
 * only attaches on the first full page load, never on subsequent navigations.
 *
 * Public surface:
 *   - setupBackupHistory(opts)  — performs hydration + subscribe + startPolling.
 *                                 Returns the cleanup handles, or null when the
 *                                 widget isn't on the current page (no-op).
 *   - teardownBackupHistory(h)  — releases the handles. Idempotent.
 *   - registerBackupHistoryLifecycle(opts)
 *                               — wires the two astro events. Returns an
 *                                 `unregister()` for test cleanup; production
 *                                 callers can ignore the return value (the
 *                                 listeners live for the page session).
 *
 * Pure functions of injected `render` + (optional) `fetchRuns` so tests can
 * exercise the lifecycle without the .astro file or real network.
 */

import { $backupRuns, setRuns, startPolling, stopPolling } from '../../stores/backup-runs'
import type { BackupRunSummary } from '../backup-runs/types'

export interface SetupOptions {
  /** Subscribed to $backupRuns; re-runs on every store update. */
  render: (runs: readonly BackupRunSummary[]) => void
  /**
   * Injectable for tests. Defaults to a real `fetch` against
   * `/api/spaces/:spaceId/backup-runs?limit=10`.
   */
  fetchRuns?: (spaceId: string) => Promise<BackupRunSummary[]>
}

export interface SetupHandles {
  unsubscribe: () => void
  /** May be null when the widget root has no `data-space-id` (defensive). */
  onBackupRunStarted: ((e: Event) => void) | null
}

/**
 * Default fetcher used in production. Returns the existing store state on a
 * non-200 so the poll loop doesn't clobber the rendered rows with empty data
 * on a transient 5xx (the next tick retries).
 */
async function defaultFetchRuns(spaceId: string): Promise<BackupRunSummary[]> {
  const res = await fetch(
    `/api/spaces/${encodeURIComponent(spaceId)}/backup-runs?limit=10`,
    { headers: { accept: 'application/json' } },
  )
  if (!res.ok) return $backupRuns.get()
  const body = (await res.json()) as { runs: BackupRunSummary[] }
  return body.runs
}

export function setupBackupHistory(
  opts: SetupOptions,
): SetupHandles | null {
  const root = document.querySelector<HTMLElement>('[data-backup-history]')
  if (!root) return null

  // Hydrate the store from the SSR JSON-script tag, if present.
  const stateEl = document.querySelector<HTMLScriptElement>(
    '[data-backup-history-state]',
  )
  if (stateEl?.textContent) {
    try {
      const parsed = JSON.parse(stateEl.textContent) as BackupRunSummary[]
      setRuns(parsed)
    } catch {
      // Corrupt SSR JSON — polling will repopulate on the first tick.
    }
  }

  const unsubscribe = $backupRuns.subscribe(opts.render)

  const spaceId = root.dataset.spaceId ?? null
  let onBackupRunStarted: ((e: Event) => void) | null = null
  if (spaceId) {
    const fetchRuns = opts.fetchRuns ?? defaultFetchRuns
    startPolling(spaceId, fetchRuns)
    onBackupRunStarted = async () => {
      const fresh = await fetchRuns(spaceId)
      setRuns(fresh)
      // Re-arm: the poll loop self-suspends as soon as every run in the
      // store is terminal (see backup-runs.ts:tick). On a page with only
      // historical succeeded runs — or an empty store — the loop went
      // dark at +2s. The new run is non-terminal; polling has to come
      // back to life so the chip flips when status transitions
      // server-side. startPolling is idempotent (its first call is
      // stopPolling), so this is safe whether or not the loop is still
      // running.
      startPolling(spaceId, fetchRuns)
    }
    window.addEventListener('backup-run-started', onBackupRunStarted)
  }

  return { unsubscribe, onBackupRunStarted }
}

export function teardownBackupHistory(
  handles: SetupHandles | null,
): void {
  if (!handles) return
  handles.unsubscribe()
  stopPolling()
  if (handles.onBackupRunStarted) {
    window.removeEventListener('backup-run-started', handles.onBackupRunStarted)
  }
}

/**
 * Wire setup() to astro:page-load and teardown() to astro:before-swap.
 * Returns an unregister function for test cleanup; production callers can
 * ignore it. Calling twice in production would stack listeners — don't.
 *
 * The astro:page-load handler does its own teardown of stale handles before
 * setting up a fresh mount, so ClientRouter navigations land cleanly even
 * when before-swap fires (which it always does in practice; the safety check
 * is for the initial-full-load case where before-swap hasn't fired yet).
 */
export function registerBackupHistoryLifecycle(opts: SetupOptions): () => void {
  let handles: SetupHandles | null = null

  const onPageLoad = (): void => {
    teardownBackupHistory(handles)
    handles = setupBackupHistory(opts)
  }
  const onBeforeSwap = (): void => {
    teardownBackupHistory(handles)
    handles = null
  }

  document.addEventListener('astro:page-load', onPageLoad)
  document.addEventListener('astro:before-swap', onBeforeSwap)

  return () => {
    document.removeEventListener('astro:page-load', onPageLoad)
    document.removeEventListener('astro:before-swap', onBeforeSwap)
    teardownBackupHistory(handles)
    handles = null
  }
}
