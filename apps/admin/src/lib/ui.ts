// Client-side helpers for the staff-action confirm dialogs.
// setButtonLoading is a verbatim port of apps/web/src/lib/ui.ts (the
// spinner-on-server-wait discipline, web CLAUDE.md §12); postAction wraps
// the JSON POST + spinner + error extraction the three action pages share.

/**
 * Variants of the shared @web Badge primitive used by admin's status maps —
 * the subset of Badge's full variant union that the staff surfaces need. The
 * status maps (RUN_STATUS_BADGE, HEALTH_BADGE, …) resolve to these so pages can
 * render `<Badge variant={MAP[key]}>` exactly like apps/web's statusMeta idiom.
 * daisyUI's info/neutral collapse onto the brand palette here (primary/default).
 */
export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error'

/**
 * Appended to a list page's description when a bounded query came back full —
 * the honest "there may be more" signal (no pagination at staff scale).
 * Returns '' below the limit so callers can always concatenate.
 */
export function truncationNote(count: number, limit: number): string {
  return count >= limit ? ` Showing the most recent ${limit}.` : ''
}

/**
 * Toggle a daisyUI loading spinner inside a submit button while waiting on
 * the server. Idempotent; call from a `finally` so it always clears.
 */
export function setButtonLoading(btn: HTMLButtonElement, loading: boolean): void {
  btn.disabled = loading
  btn.setAttribute('aria-busy', loading ? 'true' : 'false')
  const existing = btn.querySelector<HTMLElement>('[data-loading-spinner]')
  if (loading && !existing) {
    const span = document.createElement('span')
    span.dataset.loadingSpinner = ''
    span.className = 'loading loading-spinner loading-sm'
    btn.insertBefore(span, btn.firstChild)
  } else if (!loading && existing) {
    existing.remove()
  }
}

/**
 * Link target for an entity from a directory row. Orgs always link to their
 * drill-in; space/user targets fall back to the owning org's drill-in until the
 * dedicated detail routes exist (admin-entity-linking flips those to
 * `/spaces/[id]` / `/users/[id]` — a one-line change, guard-tested there). Kept
 * here so the fallback rule isn't scattered across the directory pages.
 */
export function entityHref(kind: 'org' | 'space' | 'user', id: string, orgId?: string | null): string {
  if (kind === 'org') return `/organizations/${id}`
  return orgId ? `/organizations/${orgId}` : '/'
}

export type PostActionResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string }

/** POST a staff action as JSON, driving the confirm button's spinner. */
export async function postAction(
  path: string,
  body: Record<string, unknown>,
  btn: HTMLButtonElement,
): Promise<PostActionResult> {
  setButtonLoading(btn, true)
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.ok) return { ok: true, body: parsed }
    return { ok: false, error: typeof parsed.error === 'string' ? parsed.error : `http_${res.status}` }
  } catch {
    return { ok: false, error: 'network_error' }
  } finally {
    setButtonLoading(btn, false)
  }
}
