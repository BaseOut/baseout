/**
 * Live-status wiring for the Space Home dashboard (SpaceHomeView).
 *
 * The Home page is fully SSR — KPIs, the status rail, and the Backup history
 * preview are all computed server-side from the run rows. Rather than
 * duplicate those aggregates client-side, the live poll re-renders via a
 * one-time soft reload whenever a run's STATUS changes (running → succeeded,
 * a new run appearing), the same "SSR owns structure changes" stance
 * BackupsListView takes for its empty→table transition.
 *
 * The render callback plugs into registerBackupHistoryLifecycle, whose store
 * subscription fires immediately with the hydrated SSR state — that first
 * call establishes the baseline and must never reload (reload-loop guard).
 * Per-tick count updates (recordCount ticking up on a running run) keep the
 * signature stable, so the page only reloads on meaningful transitions.
 */

import type { BackupRunSummary } from '../backup-runs/types'

export type RecordDelta = { dir: 'up' | 'down' | 'flat'; amount: number }

/** Signed change vs the previous full backup. Zero is flat — not an up-arrow. */
export function recordCountDelta(currentOrDelta: number, previous?: number): RecordDelta {
  const delta = previous === undefined ? currentOrDelta : currentOrDelta - previous
  if (delta === 0) return { dir: 'flat', amount: 0 }
  if (delta > 0) return { dir: 'up', amount: delta }
  return { dir: 'down', amount: Math.abs(delta) }
}

/**
 * Identity of the run list for change detection: ids + statuses only.
 * Progress counters mutate every poll tick on a running run and must not
 * trigger a reload.
 */
export function runsSignature(runs: readonly BackupRunSummary[]): string {
  return runs.map((r) => `${r.id}:${r.status}`).join('|')
}

/**
 * Build the render callback for the Home page's poll subscription.
 * `reload` is injected so tests can observe it; production passes a
 * query-stripping location.replace (dropping a stale ?status=running so the
 * rail re-renders from real run state, not the post-Configure param).
 */
export function createHomeLiveRender(
  reload: () => void,
): (runs: readonly BackupRunSummary[]) => void {
  let baseline: string | null = null
  return (runs) => {
    const sig = runsSignature(runs)
    if (baseline === null) {
      baseline = sig
      return
    }
    if (sig !== baseline) {
      baseline = sig
      reload()
    }
  }
}
