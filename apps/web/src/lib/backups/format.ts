/**
 * Pure formatters for the BackupHistoryWidget. Extracted so the per-row
 * mapping is unit-testable without DOM.
 */

import type { BackupRunSummary } from '../backup-runs/types'

export function statusLabel(status: string): string {
  switch (status) {
    case 'queued':
      return 'Queued'
    case 'running':
      return 'Running'
    case 'succeeded':
      return 'Succeeded'
    case 'failed':
      return 'Failed'
    case 'trial_complete':
      return 'Trial complete'
    case 'trial_truncated':
      return 'Trial — truncated'
    case 'cancelling':
      return 'Cancelling'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

/** daisyUI badge color classes. Stable per status — UI tests pin them. */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'succeeded':
      return 'badge-success'
    case 'failed':
      return 'badge-error'
    case 'running':
      return 'badge-info'
    case 'queued':
      return 'badge-ghost'
    case 'trial_complete':
    case 'trial_truncated':
    case 'cancelling':
      return 'badge-warning'
    case 'cancelled':
      return 'badge-neutral'
    default:
      return 'badge-ghost'
  }
}

/**
 * Render a duration in human-friendly form. <60s → "Xs"; <60m → "Xm Ys";
 * else → "Xh Ym". Returns null when either bound is missing (still
 * running, or never started).
 */
export function formatDuration(
  startedAt: string | null,
  completedAt: string | null,
): string | null {
  if (!startedAt || !completedAt) return null
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null
  }
  const seconds = Math.round((end - start) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remSec = seconds % 60
  if (minutes < 60) {
    return remSec === 0 ? `${minutes}m` : `${minutes}m ${remSec}s`
  }
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`
}

/**
 * Health derivation rule per PRD §6.2 (good / warning / failure).
 *   - 'failed' status                           → 'failure'
 *   - 'trial_truncated' OR sticky errorMessage  → 'warning'
 *   - everything else (incl. terminal success,
 *     queued, running)                          → 'good'
 *
 * This sits alongside the atomic `status` field — `status` is the engine's
 * state machine, `healthStatus` is the customer-facing trust signal.
 */
export type HealthStatus = 'good' | 'warning' | 'failure'

export function healthStatus(run: BackupRunSummary): HealthStatus {
  if (run.status === 'failed') return 'failure'
  if (run.status === 'trial_truncated' || run.errorMessage !== null) {
    return 'warning'
  }
  return 'good'
}

/** daisyUI badge color class for a health chip. */
export function healthBadgeClass(health: HealthStatus): string {
  switch (health) {
    case 'good':
      return 'badge-success'
    case 'warning':
      return 'badge-warning'
    case 'failure':
      return 'badge-error'
  }
}

/**
 * Title-case the engine's free-text `triggered_by` field for display.
 * Snake_case → spaces → Title Case. Falls back to the raw value when empty.
 */
export function formatTriggeredBy(value: string): string {
  if (!value) return '—'
  return value
    .split(/[_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Full locale-formatted timestamp for the detail panel (collapsed row uses
 * the shorter `toLocaleString()`). Returns '—' on null/invalid so the panel
 * never renders 'Invalid Date'.
 */
export function expandedTimestamp(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
}

/**
 * One-line summary for a row, used by the widget's <li> body. Returns the
 * record/table/attachment counts when present, falling back to a status-
 * specific message.
 */
export function describeCounts(run: BackupRunSummary): string {
  // Failed runs surface their errorMessage regardless of count values — the
  // engine-side patch writes table_count=0 / record_count=0 alongside the
  // errorMessage on a thrown failure, so the counts-only branch below would
  // mask it as "0 tables · 0 records" without this short-circuit.
  if (run.status === 'failed') {
    return run.errorMessage ?? 'Failed'
  }
  // Phase 10d: while a run is in flight AND the engine has started bumping
  // record_count via /api/internal/runs/:id/progress, show a live "Backing
  // up… N records" counter so users see motion before /complete writes the
  // final totals. The "no counts yet" branch keeps the legacy "In progress…"
  // copy for the brief window between status='running' and the first
  // /progress event.
  if (run.status === 'running') {
    if (run.recordCount === null && run.tableCount === null) {
      return 'In progress…'
    }
    const n = run.recordCount ?? 0
    return `Backing up… ${n} record${n === 1 ? '' : 's'}`
  }
  if (run.recordCount === null && run.tableCount === null) {
    if (run.status === 'queued') return 'Waiting to start…'
    return ''
  }
  const parts: string[] = []
  if (run.tableCount !== null) {
    parts.push(`${run.tableCount} table${run.tableCount === 1 ? '' : 's'}`)
  }
  if (run.recordCount !== null) {
    parts.push(`${run.recordCount} record${run.recordCount === 1 ? '' : 's'}`)
  }
  if (run.attachmentCount !== null && run.attachmentCount > 0) {
    parts.push(
      `${run.attachmentCount} attachment${run.attachmentCount === 1 ? '' : 's'}`,
    )
  }
  return parts.join(' · ')
}
