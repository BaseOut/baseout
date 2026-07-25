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
  | 'destination_not_connected'
  | 'invalid_request'
  | 'space_not_found'
  | 'space_org_mismatch'
  | 'unauthenticated'
  | 'invalid_json'
  // web-instant-webhook: interval below the tier's platform minimum (the
  // response carries `minimum`), Space's dynamic DB not ready for Instant,
  // and Airtable's 2-webhooks-per-base-per-integration cap.
  | 'webhook_poll_interval_below_minimum'
  | 'dynamic_db_not_ready'
  | 'airtable_webhook_cap_reached'
  | 'network'
  | 'unknown'

export interface SaveConfigInput {
  spaceId: string
  /** Partial body — at least one field must be set. */
  frequency?: 'monthly' | 'weekly' | 'daily' | 'instant'
  /** server-backup-scope: what the schedule(s) back up. */
  scope?: 'schema_only' | 'schema_and_data'
  /** server-backup-scope: schema-only cadence, or null to clear it. */
  schemaFrequency?: 'monthly' | 'weekly' | 'daily' | 'instant' | null
  storageType?: string
  autoAddFutureBases?: boolean
  /** web-instant-webhook: Instant-mode poll cadence (seconds, tier-gated minimum). */
  webhookPollIntervalSeconds?: number
}

export type SaveConfigResult =
  | { ok: true }
  | {
      ok: false
      error: SaveConfigError
      status: number
      /** Tier minimum, present on `webhook_poll_interval_below_minimum`. */
      minimum?: number
    }

const KNOWN_ERRORS: ReadonlySet<SaveConfigError> = new Set([
  'frequency_not_allowed',
  'unsupported_storage_type',
  'destination_not_connected',
  'invalid_request',
  'space_not_found',
  'space_org_mismatch',
  'unauthenticated',
  'invalid_json',
  'webhook_poll_interval_below_minimum',
  'dynamic_db_not_ready',
  'airtable_webhook_cap_reached',
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
  if (input.scope !== undefined) body.scope = input.scope
  if (input.schemaFrequency !== undefined) body.schemaFrequency = input.schemaFrequency
  if (input.storageType !== undefined) body.storageType = input.storageType
  if (input.autoAddFutureBases !== undefined) body.autoAddFutureBases = input.autoAddFutureBases
  if (input.webhookPollIntervalSeconds !== undefined) {
    body.webhookPollIntervalSeconds = input.webhookPollIntervalSeconds
  }

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
  const out: SaveConfigResult = { ok: false, error, status: res.status }
  // Below-minimum rejections carry the tier's platform minimum so the UI can
  // render it inline without a second lookup.
  if (
    error === 'webhook_poll_interval_below_minimum' &&
    typeof payload.minimum === 'number'
  ) {
    out.minimum = payload.minimum
  }
  return out
}
