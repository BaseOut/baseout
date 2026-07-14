// Derived background-service health (pure; testable without a DB).
//
// PRD §16.1 asks for "last run time + success/failure per background service"
// — but NO service-run log exists yet: apps/server's scheduled() is a phase-2
// TODO stub and its cron triggers are commented out. The only live scheduled
// job is Trigger.dev's hourly cleanup task, whose sole DB footprint is
// backup_runs.deleted_at. So this page derives health signals from data
// side-effects and says so honestly. A real per-service run log (a
// service_runs table written by server/workflows) is the named phase-2
// follow-up.

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
  // Most recent backup_runs.deleted_at — heartbeat of the hourly Trigger.dev
  // cleanup task. Null when nothing has ever been pruned (which is ALSO the
  // healthy state for a young install — hence 'unknown', not 'warning').
  lastCleanupAt: Date | null
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

  signals.push(
    inputs.lastCleanupAt
      ? {
          key: 'cleanup',
          label: 'Retention cleanup (Trigger.dev hourly)',
          status: 'ok',
          detail: `Last prune ${ago(inputs.lastCleanupAt, now)} (backup_runs.deleted_at). Silence can also mean nothing was eligible.`,
        }
      : {
          key: 'cleanup',
          label: 'Retention cleanup (Trigger.dev hourly)',
          status: 'unknown',
          detail: 'No pruned runs yet — either nothing is expired or the cleanup task is not running.',
        },
  )

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

export const SIGNAL_BADGE: Record<SignalStatus, string> = {
  ok: 'badge-success',
  warning: 'badge-warning',
  unknown: 'badge-ghost',
}
