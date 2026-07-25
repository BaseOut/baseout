// Derived background-service health (pure; testable without a DB).
//
// The real per-service run log (service_runs, written by apps/server's cron
// dispatch — shared-service-runs) now covers the four cron jobs + the cleanup
// pass + the prune; /services reads those rows directly (see service-runs-view).
// This file is trimmed to the signals that still have NO run-log row: the SpaceDO
// backup scheduler (per-space alarms, deliberately not instrumented — high
// cardinality) and the connection-session sweep (phase-2). Both remain honestly
// labelled "derived". The retention-cleanup signal moved to real rows.

import type { BadgeVariant } from './ui'

export type SignalStatus = 'ok' | 'warning' | 'unknown'

export interface HealthSignal {
  key: string
  label: string
  status: SignalStatus
  detail: string
}

export interface ServiceHealthInputs {
  // backup_configurations rows whose next_scheduled_at or
  // schema_next_scheduled_at is in the past — the SpaceDO alarm should have
  // fired and rescheduled, so any row here means the scheduler slipped.
  overdueScheduleCount: number
  scheduleCount: number
  // Most recent backup_runs.created_at where triggered_by = 'scheduled'.
  lastScheduledRunAt: Date | null
  // connection_sessions rows past expires_at — the sweep service isn't
  // running (it's phase-2), so these accumulate until swept.
  staleSessionCount: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function ago(from: Date, now: Date): string {
  const ms = now.getTime() - from.getTime()
  const days = Math.floor(ms / DAY_MS)
  if (days > 0) return `${days}d ago`
  const hours = Math.floor(ms / (60 * 60 * 1000))
  if (hours > 0) return `${hours}h ago`
  return `${Math.max(0, Math.floor(ms / 60000))}m ago`
}

export function deriveServiceHealth(inputs: ServiceHealthInputs, now: Date): HealthSignal[] {
  const signals: HealthSignal[] = []

  signals.push(
    inputs.scheduleCount === 0
      ? {
          key: 'scheduler',
          label: 'Backup scheduler (SpaceDO alarms)',
          status: 'unknown',
          detail: 'No backup schedules configured yet.',
        }
      : inputs.overdueScheduleCount > 0
        ? {
            key: 'scheduler',
            label: 'Backup scheduler (SpaceDO alarms)',
            status: 'warning',
            detail: `${inputs.overdueScheduleCount} of ${inputs.scheduleCount} schedules are past their next_scheduled_at — the DO alarm should have fired and rescheduled.`,
          }
        : {
            key: 'scheduler',
            label: 'Backup scheduler (SpaceDO alarms)',
            status: 'ok',
            detail: `All ${inputs.scheduleCount} schedules have a future next-run time.`,
          },
  )

  signals.push(
    inputs.lastScheduledRunAt
      ? {
          key: 'scheduled-runs',
          label: 'Scheduled backup runs',
          status: 'ok',
          detail: `Last scheduled run ${ago(inputs.lastScheduledRunAt, now)}.`,
        }
      : {
          key: 'scheduled-runs',
          label: 'Scheduled backup runs',
          status: 'unknown',
          detail: 'No run with triggered_by = scheduled has ever been recorded.',
        },
  )

  // Retention-cleanup health moved to real service_runs rows (shared-service-runs)
  // — rendered from summarizeServiceRuns on /services, not derived here.

  signals.push(
    inputs.staleSessionCount > 0
      ? {
          key: 'session-sweep',
          label: 'Connection-session sweep',
          status: 'warning',
          detail: `${inputs.staleSessionCount} stale connection_sessions past expires_at (sweep service is phase-2 — these accumulate).`,
        }
      : {
          key: 'session-sweep',
          label: 'Connection-session sweep',
          status: 'ok',
          detail: 'No stale connection-session locks.',
        },
  )

  return signals
}

// Shared @web Badge variants (not raw daisyUI classes) — see BadgeVariant.
export const SIGNAL_BADGE: Record<SignalStatus, BadgeVariant> = {
  ok: 'success',
  warning: 'warning',
  unknown: 'default',
}
