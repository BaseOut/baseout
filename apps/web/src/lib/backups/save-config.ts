/**
 * Browser-side helper that PATCHes /api/spaces/:spaceId/backup-config.
 *
 * Both FrequencyPicker.astro and StoragePicker.astro invoke this. The
 * fetch impl is injected so the helper is testable in plain Node without
 * a real network. On success returns `{ ok: true }`; on a known error
 * returns `{ ok: false, error: <code>, status: <http> }`.
 */

export type SaveConfigError =
  | 'frequency_not_allowed'
  | 'unsupported_storage_type'
  | 'invalid_request'
  | 'space_not_found'
  | 'space_org_mismatch'
  | 'unauthenticated'
  | 'invalid_json'
  | 'network'
  | 'unknown'

export interface SaveConfigInput {
  spaceId: string
  /** Partial body — at least one of frequency or storageType must be set. */
  frequency?: 'monthly' | 'weekly' | 'daily' | 'instant'
  storageType?: string
}

export type SaveConfigResult =
  | { ok: true }
  | { ok: false; error: SaveConfigError; status: number }

const KNOWN_ERRORS: ReadonlySet<SaveConfigError> = new Set([
  'frequency_not_allowed',
  'unsupported_storage_type',
  'invalid_request',
  'space_not_found',
  'space_org_mismatch',
  'unauthenticated',
  'invalid_json',
])

export interface SaveConfigDeps {
  /** Defaults to global `fetch` in browser. Tests inject a vi.fn() stub. */
  fetchImpl?: typeof fetch
}

export async function saveBackupConfig(
  input: SaveConfigInput,
  deps: SaveConfigDeps = {},
): Promise<SaveConfigResult> {
  const fetchFn = deps.fetchImpl ?? fetch
  const url = `/api/spaces/${encodeURIComponent(input.spaceId)}/backup-config`

  const body: Record<string, unknown> = {}
  if (input.frequency !== undefined) body.frequency = input.frequency
  if (input.storageType !== undefined) body.storageType = input.storageType

  let res: Response
  try {
    res = await fetchFn(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
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
  // 401 is the auth status — the route returns this when not signed in.
  // The body's `error` is "Not authenticated" in that case (free-text);
  // we map by status not by string.
  if (res.status === 401) {
    return { ok: false, error: 'unauthenticated', status: 401 }
  }
  const raw = typeof payload.error === 'string' ? payload.error : ''
  const error: SaveConfigError = KNOWN_ERRORS.has(raw as SaveConfigError)
    ? (raw as SaveConfigError)
    : 'unknown'
  return { ok: false, error, status: res.status }
}
