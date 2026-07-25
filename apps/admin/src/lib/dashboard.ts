// Pure assembly for the operations dashboard at / (admin-operations-overview).
// The page runs the bounded queries (design decision 2); this shapes active runs
// (with elapsed time), the KPI success rate, and the attention groups + their
// deep-dive links. Reuses summarizeRuns/RUN_STATUS_BADGE from backup-runs.ts (no
// window-logic duplication). now is injected for testability.

export function formatElapsed(from: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - from.getTime())
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export interface ActiveRunInput {
  id: string
  kind: 'backup' | 'restore'
  status: string
  spaceId: string | null
  spaceName: string | null
  orgId: string | null
  orgName: string | null
  startedAt: Date | null
  createdAt: Date
}
export interface ActiveRun extends ActiveRunInput {
  elapsed: string
}

/** Merge backup + restore active runs, oldest-first (longest-running surfaces first). */
export function assembleActiveRuns(rows: ActiveRunInput[], now: Date): ActiveRun[] {
  return rows
    .map((r) => ({ ...r, elapsed: formatElapsed(r.startedAt ?? r.createdAt, now) }))
    .sort((a, b) => (a.startedAt ?? a.createdAt).getTime() - (b.startedAt ?? b.createdAt).getTime())
}

export interface SuccessRate {
  rate: number | null // percent; null when no terminal runs in the window
  succeeded: number
  terminal: number
}

/** 7-day success rate over TERMINAL runs only (queued/running excluded from the denominator). */
export function successRate(statuses: string[]): SuccessRate {
  const terminal = statuses.filter((s) => s === 'succeeded' || s === 'failed' || s === 'trial_complete')
  const succeeded = terminal.filter((s) => s === 'succeeded' || s === 'trial_complete').length
  return { rate: terminal.length ? Math.round((succeeded / terminal.length) * 100) : null, succeeded, terminal: terminal.length }
}

// Deep-dive targets — single source (design decision 4). /errors + /databases exist
// now (admin-error-triage landed), so these point at the real triage surfaces.
export const DEEP_DIVE = {
  schedules: '/services',
  connections: '/errors?type=connection',
  databases: '/errors?type=space_database',
  failures: '/errors?type=backup_run',
} as const

export interface AttentionItem { label: string; sublabel: string | null; href: string }
export interface AttentionGroup { key: string; label: string; count: number; href: string; items: AttentionItem[] }

export interface AttentionInput {
  overdueSchedules: { count: number; items: AttentionItem[] }
  unhealthyConnections: { count: number; items: AttentionItem[] }
  dbErrors: { count: number; items: AttentionItem[] }
  recentFailures: { count: number; items: AttentionItem[] }
}

export function attentionGroups(input: AttentionInput): AttentionGroup[] {
  const groups: AttentionGroup[] = [
    { key: 'schedules', label: 'Overdue schedules', count: input.overdueSchedules.count, href: DEEP_DIVE.schedules, items: input.overdueSchedules.items },
    { key: 'connections', label: 'Unhealthy connections', count: input.unhealthyConnections.count, href: DEEP_DIVE.connections, items: input.unhealthyConnections.items },
    { key: 'databases', label: 'Database errors', count: input.dbErrors.count, href: DEEP_DIVE.databases, items: input.dbErrors.items },
    { key: 'failures', label: 'Recent backup failures', count: input.recentFailures.count, href: DEEP_DIVE.failures, items: input.recentFailures.items },
  ]
  return groups.filter((g) => g.count > 0)
}
