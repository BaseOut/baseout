/**
 * Browser-side helper that POSTs /api/spaces/:spaceId/backup-runs.
 *
 * Used by RunBackupButton.astro. Returns the run id + trigger ids on
 * success; maps known engine errors to a stable code surface so the UI
 * can render a specific message per code (e.g. "select at least one
 * base" for no_bases_selected).
 */

export type RunBackupError =
  | 'no_bases_selected'
  | 'no_active_connection'
  | 'invalid_connection'
  | 'config_not_found'
  | 'run_already_started'
  | 'unsupported_storage_type'
  | 'space_not_found'
  | 'space_org_mismatch'
  | 'unauthenticated'
  | 'engine_unreachable'
  | 'network'
  | 'unknown'

export interface RunBackupSuccess {
  ok: true
  runId: string
  triggerRunIds: string[]
}

export interface RunBackupFailure {
  ok: false
  error: RunBackupError
  status: number
}

export type RunBackupResult = RunBackupSuccess | RunBackupFailure

export interface RunBackupDeps {
  /** Defaults to global `fetch`. Tests inject a vi.fn() stub. */
  fetchImpl?: typeof fetch
}

const KNOWN_ERRORS: ReadonlySet<RunBackupError> = new Set([
  'no_bases_selected',
  'no_active_connection',
  'invalid_connection',
  'config_not_found',
  'run_already_started',
  'unsupported_storage_type',
  'space_not_found',
  'space_org_mismatch',
  'engine_unreachable',
])

export async function runBackup(
  spaceId: string,
  deps: RunBackupDeps = {},
): Promise<RunBackupResult> {
  const fetchFn = deps.fetchImpl ?? fetch
  const url = `/api/spaces/${encodeURIComponent(spaceId)}/backup-runs`

  let res: Response
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
  } catch {
    return { ok: false, error: 'network', status: 0 }
  }

  if (res.ok) {
    const body = (await res.json()) as {
      runId: string
      triggerRunIds: string[]
    }
    return { ok: true, runId: body.runId, triggerRunIds: body.triggerRunIds }
  }

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
  const error: RunBackupError = KNOWN_ERRORS.has(raw as RunBackupError)
    ? (raw as RunBackupError)
    : 'unknown'
  return { ok: false, error, status: res.status }
}

/**
 * Map a RunBackupError to the user-facing copy the UI should render. Kept
 * here so RunBackupButton.astro and BackupHistoryWidget.astro share the
 * same wording for the same condition.
 */
export function describeRunBackupError(error: RunBackupError): string {
  switch (error) {
    case 'no_bases_selected':
      return 'Select at least one base before running a backup.'
    case 'no_active_connection':
      return 'Connect Airtable before running a backup.'
    case 'invalid_connection':
      return 'Your Airtable connection needs to be reconnected.'
    case 'config_not_found':
      return 'Finish the backup setup wizard before running a backup.'
    case 'run_already_started':
      return 'A backup is already running for this Space.'
    case 'unsupported_storage_type':
      return 'The selected storage destination is not yet supported.'
    case 'space_not_found':
    case 'space_org_mismatch':
      return 'You do not have access to this Space.'
    case 'unauthenticated':
      return 'Please sign in again.'
    case 'engine_unreachable':
      return 'The backup engine is temporarily unavailable. Try again in a moment.'
    case 'network':
      return 'Network error — check your connection and try again.'
    case 'unknown':
      return 'Something went wrong. Please try again.'
  }
}
