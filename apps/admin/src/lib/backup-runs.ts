// Cross-org backup-run viewer assembly (pure; testable without a DB).
//
// PRD §16.1: "backup run status across all Organizations." Absorbs (and
// improves on) the web /ops page: runs are joined to spaces + organizations
// so staff see names instead of raw UUIDs.

import type { BadgeVariant } from './ui'

export interface RunRow {
  id: string
  status: string
  kind: string
  isTrial: boolean
  triggeredBy: string
  recordCount: number | null
  tableCount: number | null
  attachmentCount: number | null
  startedAt: Date | null
  completedAt: Date | null
  errorMessage: string | null
  deletedAt: Date | null
  createdAt: Date
  spaceName: string | null
  orgName: string | null
}

export interface RunSummary {
  window: '24h' | '7d'
  total: number
  succeeded: number
  failed: number
  active: number // queued | running | cancelling | deleting
}

const ACTIVE_STATUSES = new Set(['queued', 'running', 'cancelling', 'deleting'])
const SUCCESS_STATUSES = new Set(['succeeded', 'trial_complete', 'trial_truncated'])

// Shared @web Badge variants (not raw daisyUI classes) — see BadgeVariant.
export const RUN_STATUS_BADGE: Record<string, BadgeVariant> = {
  succeeded: 'success',
  running: 'primary',
  queued: 'default',
  failed: 'error',
  cancelled: 'default',
  cancelling: 'warning',
  deleting: 'warning',
  trial_complete: 'warning',
  trial_truncated: 'warning',
}

function summarizeWindow(runs: RunRow[], window: '24h' | '7d', now: Date): RunSummary {
  const cutoff = now.getTime() - (window === '24h' ? 24 : 7 * 24) * 60 * 60 * 1000
  const inWindow = runs.filter((r) => r.createdAt.getTime() >= cutoff)
  return {
    window,
    total: inWindow.length,
    succeeded: inWindow.filter((r) => SUCCESS_STATUSES.has(r.status)).length,
    failed: inWindow.filter((r) => r.status === 'failed').length,
    active: inWindow.filter((r) => ACTIVE_STATUSES.has(r.status)).length,
  }
}

export function summarizeRuns(runs: RunRow[], now: Date): RunSummary[] {
  return [summarizeWindow(runs, '24h', now), summarizeWindow(runs, '7d', now)]
}

// null status = no filter. Unknown statuses simply match nothing — the page
// links only known values, and a hand-typed ?status= is read-only anyway.
export function filterByStatus(runs: RunRow[], status: string | null): RunRow[] {
  if (!status) return runs
  return runs.filter((r) => r.status === status)
}

export function formatDuration(startedAt: Date | null, completedAt: Date | null): string {
  if (!startedAt || !completedAt) return '—'
  const ms = completedAt.getTime() - startedAt.getTime()
  if (ms < 0) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}
