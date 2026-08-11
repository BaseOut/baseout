// Backup-run drill-in assembly (pure; testable without a DB).
//
// Groups backup_run_tables rows under their backup_run_bases parent — the
// same shape the engine's GET /api/internal/runs/:id/detail returns
// (apps/server/src/pages/api/internal/runs/detail.ts), read directly from the
// master DB instead of through the engine (both read the same tables; no
// engine dependency or degraded mode needed). Rows are absent entirely for
// legacy completions predating the workflows-run-detail change.

import type { BadgeVariant } from './ui'

export interface RunBaseRow {
  id: string
  atBaseId: string
  baseName: string
  status: string // 'succeeded' | 'failed' | 'trial_complete' | 'trial_truncated'
  tablesCount: number
  recordsCount: number
  attachmentsCount: number
  startedAt: Date | null
  completedAt: Date | null
  errorMessage: string | null
}

export interface RunTableRow {
  runBaseId: string
  tableId: string
  tableName: string
  recordCount: number
  fieldCount: number
  attachmentCount: number
}

export interface RunBaseDetail extends RunBaseRow {
  tables: RunTableRow[]
}

/** Group table rows under their base by runBaseId; base order is preserved. */
export function buildRunDetail(bases: RunBaseRow[], tables: RunTableRow[]): RunBaseDetail[] {
  const tablesByBase = new Map<string, RunTableRow[]>()
  for (const t of tables) {
    const list = tablesByBase.get(t.runBaseId) ?? []
    list.push(t)
    tablesByBase.set(t.runBaseId, list)
  }
  return bases.map((b) => ({ ...b, tables: tablesByBase.get(b.id) ?? [] }))
}

// Shared @web Badge variants — base statuses are a subset of run statuses.
export const BASE_STATUS_BADGE: Record<string, BadgeVariant> = {
  succeeded: 'success',
  failed: 'error',
  trial_complete: 'warning',
  trial_truncated: 'warning',
}
