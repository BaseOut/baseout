/**
 * Shared row helpers + client-side row template for BackupsListView.
 *
 * Two consumers:
 *   - SSR (BackupsListView.astro frontmatter) imports the status/trigger/format
 *     helpers and paints the initial rows with the <Badge>/<Button> catalog
 *     components.
 *   - The live-poll path (widget-lifecycle) re-renders the <tbody> client-side
 *     via `backupRowHtml`, which reproduces the SSR row markup as an escaped
 *     string (the catalog components can't run client-side).
 *
 * Keeping the taxonomy + formatting in one module means the two render paths
 * can't drift. `backupRowHtml` mirrors the daisyUI classes the <Badge>/<Button>
 * primitives emit so a hydration re-render is visually identical.
 *
 * Status taxonomy mirrors the engine (apps/server runs/complete.ts) and the
 * store's TERMINAL_STATUSES (stores/backup-runs.ts): terminal = succeeded,
 * failed, trial_complete, trial_truncated, cancelled; in-flight = queued,
 * running.
 */

import type { BackupRunSummary } from '../backup-runs/types'

export type BadgeVariant = 'success' | 'warning' | 'error' | 'default'
export interface StatusMeta {
  label: string
  variant: BadgeVariant
}

const STATUS_META: Record<string, StatusMeta> = {
  succeeded: { label: 'Succeeded', variant: 'success' },
  trial_complete: { label: 'Trial run', variant: 'success' },
  trial_truncated: { label: 'Trial run', variant: 'warning' },
  running: { label: 'Running', variant: 'warning' },
  queued: { label: 'Queued', variant: 'default' },
  failed: { label: 'Failed', variant: 'error' },
  paused: { label: 'Paused', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'default' },
}

/**
 * Status → badge label + variant. Unknown statuses fall back to a neutral
 * default carrying the raw status string — NOT to "Cancelled" (the old view's
 * `?? statusMeta.cancelled` mislabeled the engine's real trial terminals).
 */
export function statusMetaFor(status: string): StatusMeta {
  return STATUS_META[status] ?? { label: status, variant: 'default' }
}

/** Terminal-success statuses that carry meaningful record/attachment counts. */
export function isOkStatus(status: string): boolean {
  return (
    status === 'succeeded' ||
    status === 'trial_complete' ||
    status === 'trial_truncated'
  )
}

/** In-flight statuses that render live placeholders instead of final figures. */
export function isActiveStatus(status: string): boolean {
  return status === 'running' || status === 'queued'
}

export function triggerLabel(triggeredBy: string): string {
  if (triggeredBy.startsWith('schedule')) return 'Scheduled'
  if (triggeredBy.startsWith('webhook')) return 'Webhook'
  if (triggeredBy.startsWith('onboarding')) return 'Trial'
  return 'Manual'
}

/** Normalised key matching the trigger facet-filter values (data-trigger). */
export function triggerKey(triggeredBy: string): string {
  if (triggeredBy.startsWith('schedule')) return 'scheduled'
  if (triggeredBy.startsWith('webhook')) return 'webhook'
  if (triggeredBy.startsWith('onboarding')) return 'trial'
  return 'manual'
}

export function sinceLabel(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.round(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function durationStr(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const sec = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 1000,
  )
  if (sec < 60) return `${sec}s`
  const mm = Math.floor(sec / 60)
  const ss = sec % 60
  return ss ? `${mm}m ${ss}s` : `${mm}m`
}

const nf = new Intl.NumberFormat('en-US')

const badgeClass: Record<BadgeVariant, string> = {
  success: 'badge-soft badge-success',
  warning: 'badge-soft badge-warning',
  error: 'badge-soft badge-error',
  default: 'badge-ghost',
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Render one <tr> for the audit table, matching the SSR markup in
 * BackupsListView.astro (embedded/production form: every row drills by id).
 * Used by the live-poll re-render. Every interpolated run value is escaped.
 */
export function backupRowHtml(run: BackupRunSummary): string {
  const sm = statusMetaFor(run.status)
  const ok = isOkStatus(run.status)
  const active = isActiveStatus(run.status)
  const href = `/backups/run?id=${encodeURIComponent(run.id)}`
  const spinner =
    run.status === 'running'
      ? '<span class="loading loading-spinner loading-xs"></span>'
      : ''
  const whenCell = active
    ? `<span class="text-base-content/64">${run.status === 'running' ? 'in progress' : 'queued'}</span>`
    : esc(sinceLabel(run.completedAt))
  const search = esc(`${run.id} ${(run.errorMessage ?? '').toLowerCase()}`)
  const records = ok ? nf.format(run.recordCount ?? 0) : '—'
  const attachments = ok ? nf.format(run.attachmentCount ?? 0) : '—'
  const duration = active ? '—' : esc(durationStr(run.startedAt, run.completedAt))

  return (
    `<tr class="bl-row" data-run-id="${esc(run.id)}" data-status="${esc(run.status)}"` +
    ` data-trigger="${esc(triggerKey(run.triggeredBy))}" data-date="${esc(run.completedAt ?? run.createdAt)}"` +
    ` data-search="${search}" onclick="window.location='${href}'">` +
    `<td><span class="badge ${badgeClass[sm.variant]}">${spinner}${esc(sm.label)}</span></td>` +
    `<td>${whenCell}</td>` +
    `<td class="text-base-content/64">${esc(triggerLabel(run.triggeredBy))}</td>` +
    `<td class="text-right tabular-nums">${run.includedBases.length}</td>` +
    `<td class="text-right tabular-nums">${records}</td>` +
    `<td class="text-right tabular-nums">${attachments}</td>` +
    `<td class="text-right tabular-nums text-base-content/64 mono-data">${duration}</td>` +
    `<td class="text-right"><a class="btn btn-ghost btn-sm text-primary" href="${href}" onclick="event.stopPropagation()">Details →</a></td>` +
    `</tr>`
  )
}
