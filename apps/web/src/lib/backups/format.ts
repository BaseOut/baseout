/**
 * Pure formatters for the BackupHistoryWidget. Extracted so the per-row
 * mapping is unit-testable without DOM.
 */

import type { BackupRunSummary } from '../backup-runs/types'
// Space-health derivation (below) reuses the canonical time system. The
// two-arg `formatNextScheduledAt(iso, now)` is aliased so it does not collide
// with this file's own single-arg `formatNextScheduledAt` export (kept for
// IntegrationsSetupWizard + its pinned tests).
import {
  fmtRelative,
  formatNextScheduledAt as fmtNextScheduled,
  isOverdue,
} from '../time'

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
    case 'deleting':
      return 'Deleting'
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
    case 'deleting':
      return 'badge-warning'
    case 'cancelled':
      return 'badge-neutral'
    default:
      return 'badge-ghost'
  }
}

/**
 * Backup run kind (server-backup-scope): 'full' = schema + data; 'schema' =
 * schema-only run (skips records/attachments). Shown as a secondary badge in
 * history. Unknown/legacy values fall back to 'Full' so old rows read sensibly.
 */
export function kindLabel(kind: string): string {
  return kind === 'schema' ? 'Schema' : 'Full'
}

/** daisyUI badge class for the run-kind chip (secondary to the status chip). */
export function kindBadgeClass(kind: string): string {
  return kind === 'schema' ? 'badge-info' : 'badge-ghost'
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
 * Whether a run was webhook-triggered (web-instant-webhook). The engine's
 * `triggered_by` is free-text; the webhook pipeline writes values starting
 * with 'webhook' (mirrors triggerKey in ./list-row).
 */
export function isWebhookRun(triggeredBy: string): boolean {
  return triggeredBy.startsWith('webhook')
}

/**
 * Detail line for webhook-triggered runs: "Source: Webhook · N created ·
 * N updated · N deleted", plus "· N reconciled" when a reconciliation pass
 * contributed. Returns null for non-webhook runs.
 *
 * The change counts are optional on BackupRunSummary — `backup_runs` doesn't
 * persist them yet (they arrive with the engine's incremental-run completion
 * payload in server-instant-webhook), so the line degrades to "Source:
 * Webhook" until they land.
 */
export function webhookSourceLine(run: BackupRunSummary): string | null {
  if (!isWebhookRun(run.triggeredBy)) return null
  const parts = ['Source: Webhook']
  if (
    run.createdCount != null &&
    run.updatedCount != null &&
    run.deletedCount != null
  ) {
    parts.push(
      `${run.createdCount} created`,
      `${run.updatedCount} updated`,
      `${run.deletedCount} deleted`,
    )
    if (run.reconciledRecords != null && run.reconciledRecords > 0) {
      parts.push(`${run.reconciledRecords} reconciled`)
    }
  }
  return parts.join(' · ')
}

/**
 * Format the IntegrationsView "Next backup: <date>" line. Reads
 * backup_configurations.next_scheduled_at — the unix-ms timestamp the
 * SpaceDO scheduled. NULL is rendered as "Not yet scheduled" (no schedule
 * armed yet — either pre-bootstrap or instant-frequency).
 *
 * Locale-aware via Intl.DateTimeFormat; the user's browser locale wins
 * over our server timezone. MVP fires all alarms at 00:00 UTC, so the
 * displayed time reflects what that boundary looks like in the viewer's
 * timezone.
 */
export function formatNextScheduledAt(iso: string | null): string {
  if (!iso) return 'Not yet scheduled'
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return 'Not yet scheduled'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
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
 * Footer label for a soft-deleted (cleanup-pruned) run — the cleanup engine
 * sets backup_runs.deleted_at after removing the snapshot's storage objects
 * (server-retention-and-cleanup Phase E.3). Returns '' when the run hasn't
 * been pruned (null / invalid) so the widget can skip the pruned styling.
 */
export function formatDeletedAt(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''
  return `Pruned ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)}`
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

/* ────────────────────────────────────────────────────────────────────────────
 * Space health — ONE derivation, consumed by Home's status rail (and, in a
 * later app-shell change, the connection banner + Inbox alike).
 *
 * Audit decision D01: any sentence that claims a state must be derived from the
 * newest relevant data at render time; a claim that cannot be derived is not
 * rendered. Home used to compute "Everything's backed up" from
 * `!paused && !running` — a flag about CONNECTIONS — while the runs one click
 * away said "failed". The verdict is computed once here so every surface reads
 * the same object. (Promoted from ui-only@7c7202d7 for web-space-home-dashboard.)
 * ──────────────────────────────────────────────────────────────────────────── */

/** Run statuses that mean a snapshot was actually written. */
const SUCCESS_STATUSES = ['succeeded', 'trial_succeeded', 'trial_complete']
/**
 * Run statuses that are NOT finished. `paused` belongs here: a held run has not
 * produced a verdict, and treating it as terminal let the rail report a paused
 * run as "last run" — a finished-sounding claim about something still open.
 */
const IN_FLIGHT_STATUSES = ['queued', 'running', 'cancelling', 'paused']
/** After this long with no success, the Space is degraded (the banner's own threshold). */
const DEGRADED_AFTER_MS = 24 * 60 * 60 * 1000

export function isSuccessRun(run: BackupRunSummary): boolean {
  return SUCCESS_STATUSES.includes(run.status)
}

export function isInFlightRun(run: BackupRunSummary): boolean {
  return IN_FLIGHT_STATUSES.includes(run.status)
}

/** When a run last MOVED — completed, else started, else created. */
export function runMovedAt(run: BackupRunSummary): number {
  const t = new Date(run.completedAt ?? run.startedAt ?? run.createdAt).getTime()
  return Number.isFinite(t) ? t : 0
}

export type SpaceHealthLevel =
  | 'broken'
  | 'running'
  | 'failed'
  | 'degraded'
  | 'overdue'
  | 'ok'
  | 'unknown'

export interface SpaceHealthInput {
  /** Every run the Space knows about, any order. */
  runs?: BackupRunSummary[]
  /** The source connection's display name, broken or not. Names the degraded banner. */
  sourceName?: string | null
  /** The source connection, when it has lost access. */
  brokenSource?: { name: string } | null
  /** The destination connection, when it has lost access. */
  brokenDestination?: { name: string } | null
  /** `backup_configurations.next_scheduled_at`. */
  nextScheduledAt?: string | null
  now?: number
}

/** What the app-shell banner needs. Null when the shell must stay silent. */
export interface SpaceHealthBanner {
  state: 'broken' | 'degraded'
  provider: string
  side: 'source' | 'destination'
  lastBackup?: string
}

export interface SpaceHealth {
  level: SpaceHealthLevel
  /** The rail's verdict sentence. Every word of it comes from the data below. */
  headline: string
  /** Which side lost access, when `level` is 'broken'. */
  brokenSide: 'source' | 'destination' | null
  brokenName: string | null
  /** Newest run of any status — this is what "last backup" means. */
  lastRun: BackupRunSummary | null
  lastRunAt: string | null
  lastRunLabel: string
  /** Newest run that wrote a snapshot. */
  lastSuccess: BackupRunSummary | null
  lastSuccessAt: string | null
  /** Newest FULL (data) success — a schema-only run carries no record counts. */
  lastFullSuccess: BackupRunSummary | null
  /** True when the newest run is not the newest success, so both must be named. */
  successDiffers: boolean
  nextLabel: string
  overdue: boolean
  banner: SpaceHealthBanner | null
}

export function runKind(run: BackupRunSummary): 'schema' | 'full' {
  return run.kind === 'schema' ? 'schema' : 'full'
}

export function deriveSpaceHealth(input: SpaceHealthInput = {}): SpaceHealth {
  const now = input.now ?? Date.now()
  const runs = input.runs ?? []
  const sorted = [...runs].sort((a, b) => runMovedAt(b) - runMovedAt(a))

  const lastRun = sorted[0] ?? null
  const inFlight = sorted.find(isInFlightRun) ?? null
  const lastSuccess = sorted.find(isSuccessRun) ?? null
  const lastFullSuccess =
    sorted.find((r) => isSuccessRun(r) && runKind(r) === 'full') ?? null

  const brokenSource = input.brokenSource ?? null
  const brokenDestination = input.brokenDestination ?? null
  const overdue = isOverdue(input.nextScheduledAt ?? null, now)
  const nextLabel = fmtNextScheduled(input.nextScheduledAt ?? null, now)

  const lastSuccessAt = lastSuccess?.completedAt ?? null
  const successAge = lastSuccessAt
    ? now - new Date(lastSuccessAt).getTime()
    : Number.POSITIVE_INFINITY
  // "Degraded" only means something once the Space has had a chance to run. A
  // Space with no runs at all is 'unknown', not stale — and a Space with a run
  // IN FLIGHT is not silent either: the sentence "no successful backup in 24
  // hours, we're retrying" would be describing the attempt happening on screen.
  const stale = runs.length > 0 && !inFlight && successAge > DEGRADED_AFTER_MS

  let level: SpaceHealthLevel
  if (brokenSource || brokenDestination) level = 'broken'
  else if (inFlight) level = 'running'
  else if (lastRun?.status === 'failed') level = 'failed'
  else if (runs.length === 0) level = 'unknown'
  else if (stale) level = 'degraded'
  else if (overdue) level = 'overdue'
  else level = 'ok'

  const lastRunSince = fmtRelative(
    lastRun?.completedAt ?? lastRun?.startedAt ?? lastRun?.createdAt ?? null,
    now,
  )
  const lastSuccessSince = fmtRelative(lastSuccessAt, now)

  let headline: string
  if (level === 'broken') headline = 'Backups paused'
  else if (level === 'running')
    headline =
      inFlight?.status === 'queued'
        ? 'Backup queued'
        : inFlight?.status === 'paused'
          ? 'Backup paused'
          : 'Backup running…'
  else if (level === 'failed') headline = 'Last run failed'
  else if (level === 'unknown') headline = 'No backup has run yet'
  else if (level === 'degraded') headline = 'No successful backup in 24 hours'
  else if (level === 'overdue') headline = nextLabel
  else headline = lastSuccessSince ? `Backed up ${lastSuccessSince}` : 'Backed up'

  const banner: SpaceHealthBanner | null = brokenSource
    ? {
        state: 'broken',
        provider: brokenSource.name,
        side: 'source',
        ...(lastSuccessSince ? { lastBackup: lastSuccessSince } : {}),
      }
    : brokenDestination
      ? { state: 'broken', provider: brokenDestination.name, side: 'destination' }
      : // A degraded banner names the connection it is about. With no source name
        // to print there is no sentence to derive, so the shell stays silent
        // rather than printing a placeholder where a name belongs.
        stale && input.sourceName
        ? { state: 'degraded', provider: input.sourceName, side: 'source' }
        : null

  return {
    level,
    headline,
    brokenSide: brokenSource ? 'source' : brokenDestination ? 'destination' : null,
    brokenName: brokenSource?.name ?? brokenDestination?.name ?? null,
    lastRun,
    lastRunAt: lastRun?.completedAt ?? lastRun?.startedAt ?? lastRun?.createdAt ?? null,
    lastRunLabel: lastRunSince ?? '—',
    lastSuccess,
    lastSuccessAt,
    lastFullSuccess,
    successDiffers: !!lastRun && lastRun !== lastSuccess,
    nextLabel,
    overdue,
    banner,
  }
}
