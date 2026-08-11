// Cross-org restore-run viewer assembly (pure; testable without a DB).
// Mirrors lib/backup-runs.ts for restore_runs — staff visibility into restore
// activity (there was previously none anywhere).

import type { BadgeVariant } from './ui'

export interface RestoreRow {
  id: string
  status: string
  scope: string
  scopeTarget: unknown
  tablesRestored: number
  recordsRestored: number
  attachmentsRestored: number
  triggeredBy: string
  isTrial: boolean
  startedAt: Date | null
  completedAt: Date | null
  errorMessage: string | null
  createdAt: Date
  spaceName: string | null
  orgName: string | null
}

// Shared @web Badge variants (not raw daisyUI classes) — see BadgeVariant.
export const RESTORE_STATUS_BADGE: Record<string, BadgeVariant> = {
  succeeded: 'success',
  running: 'primary',
  queued: 'default',
  failed: 'error',
  cancelled: 'default',
  cancelling: 'warning',
}

export interface RestoreSummary {
  window: '24h' | '7d'
  total: number
  succeeded: number
  failed: number
  active: number // queued | running | cancelling
}

const ACTIVE_STATUSES = new Set(['queued', 'running', 'cancelling'])

function summarizeWindow(rows: RestoreRow[], window: '24h' | '7d', now: Date): RestoreSummary {
  const cutoff = now.getTime() - (window === '24h' ? 24 : 7 * 24) * 60 * 60 * 1000
  const inWindow = rows.filter((r) => r.createdAt.getTime() >= cutoff)
  return {
    window,
    total: inWindow.length,
    succeeded: inWindow.filter((r) => r.status === 'succeeded').length,
    failed: inWindow.filter((r) => r.status === 'failed').length,
    active: inWindow.filter((r) => ACTIVE_STATUSES.has(r.status)).length,
  }
}

export function summarizeRestores(rows: RestoreRow[], now: Date): RestoreSummary[] {
  return [summarizeWindow(rows, '24h', now), summarizeWindow(rows, '7d', now)]
}

// null status = no filter (same contract as backup-runs filterByStatus).
export function filterByStatus(rows: RestoreRow[], status: string | null): RestoreRow[] {
  if (!status) return rows
  return rows.filter((r) => r.status === status)
}

/** Human line for the restore scope: 'base appXXX', 'table appXXX/tblYYY', 'point-in-time'. */
export function describeScope(scope: string, scopeTarget: unknown): string {
  const target = (scopeTarget ?? {}) as { baseId?: unknown; tableId?: unknown }
  const baseId = typeof target.baseId === 'string' ? target.baseId : null
  const tableId = typeof target.tableId === 'string' ? target.tableId : null
  if (scope === 'base') return baseId ? `base ${baseId}` : 'base'
  if (scope === 'table') {
    if (baseId && tableId) return `table ${baseId}/${tableId}`
    return tableId ? `table ${tableId}` : 'table'
  }
  if (scope === 'point_in_time') return 'point-in-time'
  return scope
}
