/**
 * Browser-side helper that POSTs /api/spaces/:spaceId/backup-config/bases
 * with the selected base ids.
 *
 * Used by the Manage-bases screen (IntegrationsManageBasesView). Mirrors
 * the save-config.ts DI pattern: fetch is injected so the helper is
 * testable in plain Node.
 */

export type SaveSelectionError =
  | 'over_tier_limit'
  | 'unknown_base_ids'
  | 'invalid_request'
  | 'space_not_found'
  | 'space_org_mismatch'
  | 'unauthenticated'
  | 'network'
  | 'unknown'

export type SaveSelectionResult =
  | { ok: true }
  | { ok: false; error: SaveSelectionError; status: number }

const KNOWN_ERRORS: ReadonlySet<SaveSelectionError> = new Set([
  'over_tier_limit',
  'unknown_base_ids',
  'invalid_request',
  'space_not_found',
  'space_org_mismatch',
])

export interface SaveSelectionDeps {
  /** Defaults to global `fetch` in browser. Tests inject a vi.fn() stub. */
  fetchImpl?: typeof fetch
}

export async function saveBaseSelection(
  spaceId: string,
  atBaseIds: string[],
  deps: SaveSelectionDeps = {},
): Promise<SaveSelectionResult> {
  const fetchFn = deps.fetchImpl ?? fetch
  const url = `/api/spaces/${encodeURIComponent(spaceId)}/backup-config/bases`

  let res: Response
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ atBaseIds }),
    })
  } catch {
    return { ok: false, error: 'network', status: 0 }
  }

  if (res.ok) return { ok: true }

  let payload: Record<string, unknown> = {}
  try {
    payload = (await res.json()) as Record<string, unknown>
  } catch {
    // non-JSON; fall through with empty payload
  }
  if (res.status === 401) {
    return { ok: false, error: 'unauthenticated', status: 401 }
  }
  const raw = typeof payload.error === 'string' ? payload.error : ''
  const error: SaveSelectionError = KNOWN_ERRORS.has(raw as SaveSelectionError)
    ? (raw as SaveSelectionError)
    : 'unknown'
  return { ok: false, error, status: res.status }
}

/** User-facing copy per error code (shared by callers). */
export function describeSaveSelectionError(error: SaveSelectionError): string {
  switch (error) {
    case 'over_tier_limit':
      return 'Selection exceeds your plan limit. Deselect some bases to continue.'
    case 'unknown_base_ids':
      return 'Some bases are no longer in your workspace. Reload and try again.'
    case 'space_not_found':
    case 'space_org_mismatch':
      return 'You do not have access to this Space.'
    case 'unauthenticated':
      return 'Please sign in again.'
    case 'network':
      return 'Network error — check your connection and try again.'
    case 'invalid_request':
    case 'unknown':
      return 'Could not save your selection. Please try again.'
  }
}
