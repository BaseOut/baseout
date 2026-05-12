/**
 * Cross-component reactive store for the backup-history surface.
 *
 * Per CLAUDE.md §4: nanostores for shared state, hydrate from a
 * <script type="application/json"> tag in the page, never store secrets.
 *
 * `startPolling` owns a single module-scoped interval. While any run is
 * non-terminal it re-fetches every 10s; as soon as every run is terminal
 * (succeeded / failed / trial_complete / trial_truncated) the interval
 * stops on its own. `stopPolling` is the manual cancel for unmount.
 *
 * The fetch function is injected so the component wires real `fetch` and
 * tests inject vi.fn() stubs. The store does not assume window or DOM
 * exist — the same module loads in vitest's node environment cleanly.
 */

import { atom } from 'nanostores'
import type { BackupRunSummary } from '../lib/backup-runs/types'

export const $backupRuns = atom<BackupRunSummary[]>([])

export function setRuns(runs: BackupRunSummary[]): void {
  $backupRuns.set(runs)
}

const TERMINAL_STATUSES = new Set([
  'succeeded',
  'failed',
  'trial_complete',
  'trial_truncated',
])

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status)
}

function allTerminal(runs: BackupRunSummary[]): boolean {
  return runs.every((r) => isTerminalStatus(r.status))
}

// Phase 10d: dropped from 10s to 2s so the live "Backing up… N records"
// counter in BackupHistoryWidget feels responsive. The interval only ticks
// while any run is non-terminal; once every run is `succeeded` / `failed`
// / `trial_*`, the timer stops on its own (see allTerminal check in tick).
const POLL_INTERVAL_MS = 2_000

let activeTimeout: ReturnType<typeof setTimeout> | null = null
let activeToken = 0

export type FetchRunsFn = (
  spaceId: string,
) => Promise<BackupRunSummary[]>

/**
 * Begin polling. Schedules `fetchFn(spaceId)` to fire every 10s while any
 * run in the store is non-terminal. The FIRST call lands at t+10s, NOT
 * immediately — the page is expected to SSR initial data and hydrate it
 * via the JSON-script tag (CLAUDE.md §4 pattern), so polling is purely
 * the maintenance loop.
 *
 * Replaces any existing poll. `stopPolling()` (or another `startPolling`)
 * cancels and invalidates any in-flight fetch from the prior poll.
 *
 * Uses a chained setTimeout (not setInterval) so the next tick is only
 * scheduled AFTER the previous fetch resolves — overlapping fetches are
 * impossible, and the test harness drives this deterministically.
 */
export function startPolling(spaceId: string, fetchFn: FetchRunsFn): void {
  stopPolling()
  const token = ++activeToken

  function schedule(): void {
    if (token !== activeToken) return
    activeTimeout = setTimeout(tick, POLL_INTERVAL_MS)
  }

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
    } catch {
      // Swallow transient fetch errors; the next tick retries. `console.*`
      // is forbidden per CLAUDE.md §5 — a structured logger plugs in here.
    }
    schedule()
  }

  // First tick lands at t+10s; SSR hydration covers the initial render.
  schedule()
}

export function stopPolling(): void {
  if (activeTimeout !== null) {
    clearTimeout(activeTimeout)
    activeTimeout = null
  }
  // Bumping the token also invalidates any in-flight fetch from the
  // replaced poll, so its result won't clobber the new state.
  activeToken++
}
