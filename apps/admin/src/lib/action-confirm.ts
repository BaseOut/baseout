// Client wiring for the staff-action confirm dialog (ActionConfirm.astro).
// Pages mark trigger buttons with data attributes:
//   data-action-path    POST endpoint (/api/actions/…)
//   data-action-payload JSON body
//   data-action-label   confirmation copy shown in the dialog
// Success reloads the page (surfaces are SSR — the reload re-renders truth);
// failure shows the error code inline and leaves the dialog open.

import { postAction } from './ui'

export function initActionConfirm(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#action-confirm')
  if (!dialog) return
  const labelEl = dialog.querySelector<HTMLElement>('[data-confirm-label]')
  const errorEl = dialog.querySelector<HTMLElement>('[data-confirm-error]')
  const confirmBtn = dialog.querySelector<HTMLButtonElement>('[data-confirm-button]')
  if (!labelEl || !errorEl || !confirmBtn) return

  let pending: { path: string; payload: Record<string, unknown> } | null = null

  document.querySelectorAll<HTMLButtonElement>('[data-action-path]').forEach((btn) => {
    btn.addEventListener('click', () => {
      let payload: Record<string, unknown> = {}
      try {
        payload = JSON.parse(btn.dataset.actionPayload ?? '{}') as Record<string, unknown>
      } catch {
        return
      }
      pending = { path: btn.dataset.actionPath ?? '', payload }
      labelEl.textContent = btn.dataset.actionLabel ?? 'Are you sure?'
      errorEl.classList.add('hidden')
      errorEl.textContent = ''
      dialog.showModal()
    })
  })

  confirmBtn.addEventListener('click', async () => {
    if (!pending) return
    const result = await postAction(pending.path, pending.payload, confirmBtn)
    if (result.ok) {
      dialog.close()
      window.location.reload()
    } else {
      errorEl.textContent = `Action failed: ${result.error}`
      errorEl.classList.remove('hidden')
    }
  })
}
