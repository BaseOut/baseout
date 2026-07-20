// Pure summariser for the /services surface (shared-service-runs D7). No DB, no
// UI — takes the newest-N service_runs rows per service and derives per-service
// health. Forward-tolerant: an unknown service id found in the rows still
// renders (labelled by its raw id).

export type ServiceCadence = 'quarter-hour' | 'hourly' | 'daily'

// LOCKSTEP COPY of apps/server SERVICE_IDS + display metadata. Admin cannot import
// server code (separate app), so the registry is duplicated here; keep the two in
// sync (same pattern as isInternalEmail). Staleness window = 4 × expected cadence.
export const SERVICE_DISPLAY: Record<string, { label: string; cadence: ServiceCadence; reserved?: boolean }> = {
  // live (instrumented today)
  oauth_refresh_sweep: { label: 'OAuth refresh sweep', cadence: 'quarter-hour' },
  run_reconciliation: { label: 'Run reconciliation', cadence: 'quarter-hour' },
  oauth_keepalive: { label: 'OAuth keep-alive', cadence: 'daily' },
  connection_auto_invalidate: { label: 'Connection auto-invalidate', cadence: 'daily' },
  retention_cleanup: { label: 'Retention cleanup', cadence: 'hourly' },
  service_runs_prune: { label: 'Service-run log prune', cadence: 'daily' },
  // reserved (named, not yet instrumented)
  webhook_renewal: { label: 'Webhook renewal', cadence: 'hourly', reserved: true },
  connection_lock_sweep: { label: 'Connection-lock sweep', cadence: 'quarter-hour', reserved: true },
  dead_connection_check: { label: 'Dead-connection cadence', cadence: 'daily', reserved: true },
  rediscovery: { label: 'Base rediscovery', cadence: 'daily', reserved: true },
  trial_expiry_monitor: { label: 'Trial-expiry monitor', cadence: 'daily', reserved: true },
  quota_usage_monitor: { label: 'Quota-usage monitor', cadence: 'daily', reserved: true },
}

const WINDOW_MS: Record<ServiceCadence, number> = {
  'quarter-hour': 4 * 15 * 60 * 1000, // 1h
  hourly: 4 * 60 * 60 * 1000, // 4h
  daily: 4 * 24 * 60 * 60 * 1000, // 4d
}

export interface ServiceRunRow {
  service: string
  status: string // started | succeeded | failed
  startedAt: Date
  completedAt: Date | null
  durationMs: number | null
  errorMessage: string | null
  counts: unknown
}

export interface ServiceSummary {
  service: string
  label: string
  reserved: boolean
  known: boolean
  latest: ServiceRunRow | null
  lastSuccessAt: Date | null
  failureStreak: number
  recentDurations: number[]
  stale: boolean
}

const RECENT_DURATIONS = 10

function summarizeOne(service: string, rows: ServiceRunRow[], now: Date): ServiceSummary {
  const meta = SERVICE_DISPLAY[service]
  const sorted = [...rows].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
  const latest = sorted[0] ?? null

  let failureStreak = 0
  for (const r of sorted) {
    if (r.status === 'failed') failureStreak++
    else break
  }
  const success = sorted.find((r) => r.status === 'succeeded')
  const lastSuccessAt = success ? success.completedAt ?? success.startedAt : null
  const recentDurations = sorted
    .filter((r) => typeof r.durationMs === 'number')
    .slice(0, RECENT_DURATIONS)
    .map((r) => r.durationMs as number)

  const stale =
    !!latest &&
    latest.status === 'started' &&
    now.getTime() - latest.startedAt.getTime() > WINDOW_MS[meta?.cadence ?? 'daily']

  return {
    service,
    label: meta?.label ?? service,
    reserved: meta?.reserved ?? false,
    known: !!meta,
    latest,
    lastSuccessAt,
    failureStreak,
    recentDurations,
    stale,
  }
}

/**
 * Per-service summaries. Every registry service appears (live first, then
 * reserved), even with no rows ("not yet run"); any unknown service id present
 * in the rows is appended (forward-tolerant). `now` drives staleness.
 */
export function summarizeServiceRuns(rows: ServiceRunRow[], now: Date): ServiceSummary[] {
  const byService = new Map<string, ServiceRunRow[]>()
  for (const r of rows) {
    const arr = byService.get(r.service) ?? []
    arr.push(r)
    byService.set(r.service, arr)
  }

  const order = Object.keys(SERVICE_DISPLAY)
  const registrySet = new Set(order)
  const unknown = [...byService.keys()].filter((s) => !registrySet.has(s)).sort()

  const live = order.filter((s) => !SERVICE_DISPLAY[s]!.reserved)
  const reserved = order.filter((s) => SERVICE_DISPLAY[s]!.reserved)

  return [...live, ...reserved, ...unknown].map((service) =>
    summarizeOne(service, byService.get(service) ?? [], now),
  )
}

/** The N most-recent failed rows across all services (recent-failures list). */
export function recentFailures(rows: ServiceRunRow[], limit = 20): ServiceRunRow[] {
  return rows
    .filter((r) => r.status === 'failed')
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, limit)
}
