/**
 * Cancel-button render + click handler for the BackupHistoryWidget.
 *
 * Extracted so the render-gate + POST contract is unit-testable in
 * happy-dom without driving the whole widget. The Astro component imports
 * both helpers from here and wires the click handler via document-level
 * delegation.
 */

import type { BackupRunSummary } from '../backup-runs/types'
import { setButtonLoading } from '../ui'

/**
 * Statuses where the engine can still accept a cancel:
 *   - 'queued'  : the run hasn't fanned out yet; cancel flips it straight
 *                 to 'cancelled'.
 *   - 'running' : Trigger.dev tasks are in flight; cancel asks Trigger.dev
 *                 to abort each and flips the run to 'cancelled'.
 *
 * 'cancelling' is intentionally excluded — the engine has already
 * accepted the cancel and is asking Trigger.dev to abort. A second click
 * would just race the engine's own write to 'cancelled'.
 */
export const CANCELLABLE_STATUSES: ReadonlySet<string> = new Set([
  'queued',
  'running',
])

export function isCancellable(status: string): boolean {
  return CANCELLABLE_STATUSES.has(status)
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * HTML for a Cancel button, or an empty string when the run is not
 * cancellable. Mirrors the SSR markup in BackupHistoryWidget.astro so
 * the dynamic re-render path produces an identical button.
 */
export function cancelButtonHtml(run: Pick<BackupRunSummary, 'id' | 'status'>): string {
  if (!isCancellable(run.status)) return ''
  const id = escapeAttr(run.id)
  return `<button type="button" class="btn btn-xs btn-outline btn-warning ml-auto" data-cancel-run="${id}" aria-label="Cancel backup run ${id}">Cancel</button>`
}

export interface CancelClickDeps {
  /** Test seam — defaults to global `fetch`. */
  fetchImpl?: typeof fetch
}

/**
 * Document-level click delegate. Returns true when the event was handled
 * (a Cancel button was clicked), false otherwise — caller decides whether
 * to short-circuit propagation. The implementation calls
 * `event.preventDefault()` + `event.stopPropagation()` on a handled click
 * so the parent <summary> doesn't toggle the <details>.
 *
 * The button's `setButtonLoading` is cleared in a finally so a network
 * drop never leaves the UI stuck.
 */
export async function handleCancelClick(
  event: MouseEvent,
  deps: CancelClickDeps = {},
): Promise<boolean> {
  const target = event.target
  if (!(target instanceof Element)) return false
  const btn = target.closest<HTMLButtonElement>('button[data-cancel-run]')
  if (!btn) return false
  const runId = btn.dataset.cancelRun
  if (!runId) return false
  event.preventDefault()
  event.stopPropagation()

  const root = btn.closest<HTMLElement>('[data-backup-history]')
  const spaceId = root?.dataset.spaceId
  if (!spaceId) return true

  const fetchFn = deps.fetchImpl ?? fetch
  setButtonLoading(btn, true)
  try {
    await fetchFn(
      `/api/spaces/${encodeURIComponent(spaceId)}/backup-runs/${encodeURIComponent(runId)}/cancel`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
    )
  } catch {
    // Transient network errors are swallowed; polling will catch up if
    // the cancel did land server-side. No toast infra wired in MVP.
  } finally {
    setButtonLoading(btn, false)
  }
  return true
}
