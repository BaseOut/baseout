/**
 * Delete-button render + click handler for the BackupHistoryWidget.
 *
 * Filed by openspec/changes/shared-backup-run-delete (Phase D.3). Mirrors
 * cancel-button.ts for layout + lifecycle; differs in three places:
 *   - Render gate: terminal statuses only (queued/running need Cancel first).
 *   - Click handler gates on window.confirm before posting — single-step
 *     confirmation matches the cancel pattern's restraint, but for a
 *     destructive action we explicitly stop and ask.
 *   - Button class is `btn-error` to signal danger.
 */

import type { BackupRunSummary } from '../backup-runs/types'
import { setButtonLoading } from '../ui'

/**
 * Statuses where the engine accepts a delete. All terminal — the row is no
 * longer changing under us. queued / running / cancelling rows must be
 * Cancelled first; 'deleting' rows are already mid-pipeline.
 */
export const DELETABLE_STATUSES: ReadonlySet<string> = new Set([
  'succeeded',
  'failed',
  'cancelled',
  'trial_complete',
  'trial_truncated',
])

export function isDeletable(status: string): boolean {
  return DELETABLE_STATUSES.has(status)
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
 * HTML for a Delete button, or an empty string when the run is not
 * deletable. Mirrors the SSR markup in BackupHistoryWidget.astro so the
 * dynamic re-render path produces an identical button.
 */
export function deleteButtonHtml(
  run: Pick<BackupRunSummary, 'id' | 'status'>,
): string {
  if (!isDeletable(run.status)) return ''
  const id = escapeAttr(run.id)
  return `<button type="button" class="btn btn-xs btn-outline btn-error" data-delete-run="${id}" aria-label="Delete backup run ${id}">Delete</button>`
}

const CONFIRM_MESSAGE =
  'Delete this backup permanently? This removes the row and the backup files. This cannot be undone.'

export interface DeleteClickDeps {
  /** Test seam — defaults to global `fetch`. */
  fetchImpl?: typeof fetch
  /**
   * Test seam — defaults to `window.confirm`. Returns true if the user
   * confirmed the deletion.
   */
  confirmImpl?: (message: string) => boolean
}

/**
 * Document-level click delegate. Returns true when the event was handled
 * (a Delete button was clicked), false otherwise.
 *
 * Confirmation gate runs BEFORE setButtonLoading so a cancelled dialog
 * leaves the button in its default state (no spinner flash). On confirm,
 * the in-flight loading state is cleared in a finally so a network drop
 * doesn't leave the UI stuck.
 */
export async function handleDeleteClick(
  event: MouseEvent,
  deps: DeleteClickDeps = {},
): Promise<boolean> {
  const target = event.target
  if (!(target instanceof Element)) return false
  const btn = target.closest<HTMLButtonElement>('button[data-delete-run]')
  if (!btn) return false
  const runId = btn.dataset.deleteRun
  if (!runId) return false
  event.preventDefault()
  event.stopPropagation()

  const confirmFn =
    deps.confirmImpl ?? ((m: string) => window.confirm(m))
  if (!confirmFn(CONFIRM_MESSAGE)) {
    return true
  }

  const root = btn.closest<HTMLElement>('[data-backup-history]')
  const spaceId = root?.dataset.spaceId
  if (!spaceId) return true

  const fetchFn = deps.fetchImpl ?? fetch
  setButtonLoading(btn, true)
  try {
    await fetchFn(
      `/api/spaces/${encodeURIComponent(spaceId)}/backup-runs/${encodeURIComponent(runId)}/delete`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
    )
  } catch {
    // Transient network errors are swallowed; polling will catch up if
    // the delete did land server-side. No toast infra wired in MVP.
  } finally {
    setButtonLoading(btn, false)
  }
  return true
}
