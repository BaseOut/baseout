/**
 * Pure validation + upsert dispatcher for the backup-config policy
 * (frequency + storage destination).
 *
 * Rules:
 *   - Body keys are restricted to `frequency` and `storageType`. Unknown
 *     keys → invalid_request.
 *   - At least one of the two fields must be present (no-op rejected).
 *   - `frequency` must be a known label AND allowed by the org's tier
 *     capability (Features §6.1). Otherwise → invalid_request /
 *     frequency_not_allowed.
 *   - `storageType` is restricted to `r2_managed` for MVP per Phase 10a
 *     scope. Other values → unsupported_storage_type even if syntactically
 *     correct. The StoragePicker UI prevents this in normal use; this
 *     check is defense-in-depth.
 *
 * Mirrors the start.ts DI pattern: the route owns the DB upsert, this
 * helper validates + dispatches via a vi.fn-able dep.
 */

import {
  TIER_CAPABILITIES,
  getTierCapabilities,
  type Frequency,
  type Tier,
} from '../capabilities/tier-capabilities'

const ALLOWED_BODY_KEYS = new Set([
  'frequency',
  'storageType',
  'autoAddFutureBases',
  // server-backup-scope: what to back up + the schema schedule.
  'scope',
  'schemaFrequency',
])
const ALLOWED_SCOPES = new Set(['schema_only', 'schema_and_data'])
const ALL_FREQUENCIES: ReadonlySet<Frequency> = new Set([
  'monthly',
  'weekly',
  'daily',
  'instant',
])
// Accept list:
//   - r2_managed: legacy default; workflows currently routes it to LocalFsWriter
//     per `system-r2-park` (R2 binding removed).
//   - local_fs: explicit dev-only writer (mirrors the workflows factory default).
//   - google_drive: first BYOS cloud destination (openspec/changes/shared-byos-drive).
//   - box: second BYOS cloud destination (box-provider commit chain).
//   - dropbox: third BYOS cloud destination (dropbox-provider commit chain).
//   - onedrive: fourth BYOS cloud destination (onedrive-provider commit chain;
//     PKCE-only public client, no client secret — see apps/web/src/lib/onedrive).
// Subsequent BYOS providers (S3, Frame.io) widen this set when each lands.
const ALLOWED_STORAGE_TYPES = new Set([
  'r2_managed',
  'local_fs',
  'google_drive',
  'box',
  'dropbox',
  'onedrive',
])

export interface PersistBackupConfigPolicyInput {
  spaceId: string
  body: Record<string, unknown>
  tier: Tier | null
}

export interface UpsertConfigInput {
  spaceId: string
  frequency?: Frequency
  storageType?: string
  autoAddFutureBases?: boolean
  /** server-backup-scope: 'schema_only' | 'schema_and_data'. */
  scope?: string
  /** server-backup-scope: the schema schedule cadence, or null to clear it. */
  schemaFrequency?: Frequency | null
}

export interface PersistBackupConfigPolicyDeps {
  upsertConfig: (input: UpsertConfigInput) => Promise<void>
}

export type PersistBackupConfigPolicyResult =
  | { ok: true }
  | {
      ok: false
      error: 'invalid_request' | 'frequency_not_allowed' | 'unsupported_storage_type'
    }

export async function persistBackupConfigPolicy(
  input: PersistBackupConfigPolicyInput,
  deps: PersistBackupConfigPolicyDeps,
): Promise<PersistBackupConfigPolicyResult> {
  // 1. Reject unknown body keys.
  for (const key of Object.keys(input.body)) {
    if (!ALLOWED_BODY_KEYS.has(key)) {
      return { ok: false, error: 'invalid_request' }
    }
  }

  // 2. Validate frequency type + literal value.
  let frequency: Frequency | undefined
  if ('frequency' in input.body) {
    const v = input.body.frequency
    if (typeof v !== 'string' || !ALL_FREQUENCIES.has(v as Frequency)) {
      return { ok: false, error: 'invalid_request' }
    }
    frequency = v as Frequency
  }

  // 3. Validate storageType type + MVP restriction.
  let storageType: string | undefined
  if ('storageType' in input.body) {
    const v = input.body.storageType
    if (typeof v !== 'string') {
      return { ok: false, error: 'invalid_request' }
    }
    if (!ALLOWED_STORAGE_TYPES.has(v)) {
      return { ok: false, error: 'unsupported_storage_type' }
    }
    storageType = v
  }

  // 3b. Validate autoAddFutureBases. Booleans only — tier-gating happens
  //     on the engine side at rediscovery time (it just won't auto-add
  //     past the cap), so no tier check needed here.
  let autoAddFutureBases: boolean | undefined
  if ('autoAddFutureBases' in input.body) {
    const v = input.body.autoAddFutureBases
    if (typeof v !== 'boolean') {
      return { ok: false, error: 'invalid_request' }
    }
    autoAddFutureBases = v
  }

  // 3c. Validate scope (server-backup-scope).
  let scope: string | undefined
  if ('scope' in input.body) {
    const v = input.body.scope
    if (typeof v !== 'string' || !ALLOWED_SCOPES.has(v)) {
      return { ok: false, error: 'invalid_request' }
    }
    scope = v
  }

  // 3d. Validate schemaFrequency. `null` clears the schema schedule; a string
  //     must be a known cadence (tier-gated below alongside `frequency`).
  let schemaFrequency: Frequency | null | undefined
  if ('schemaFrequency' in input.body) {
    const v = input.body.schemaFrequency
    if (v === null) {
      schemaFrequency = null
    } else if (typeof v === 'string' && ALL_FREQUENCIES.has(v as Frequency)) {
      schemaFrequency = v as Frequency
    } else {
      return { ok: false, error: 'invalid_request' }
    }
  }

  // 4. Reject empty bodies (no-op upsert).
  if (
    frequency === undefined &&
    storageType === undefined &&
    autoAddFutureBases === undefined &&
    scope === undefined &&
    schemaFrequency === undefined
  ) {
    return { ok: false, error: 'invalid_request' }
  }

  // 5. Tier-gate both cadences. Unknown tier falls back to starter caps.
  const caps = getTierCapabilities(input.tier)
  if (frequency !== undefined && !caps.frequencies.includes(frequency)) {
    return { ok: false, error: 'frequency_not_allowed' }
  }
  if (
    schemaFrequency != null &&
    !caps.frequencies.includes(schemaFrequency)
  ) {
    return { ok: false, error: 'frequency_not_allowed' }
  }

  // 6. Dispatch the upsert. Only include the fields actually present in
  //    the body; the route's upsert dep does the partial UPDATE/INSERT.
  const upsertInput: UpsertConfigInput = { spaceId: input.spaceId }
  if (frequency !== undefined) upsertInput.frequency = frequency
  if (storageType !== undefined) upsertInput.storageType = storageType
  if (autoAddFutureBases !== undefined) {
    upsertInput.autoAddFutureBases = autoAddFutureBases
  }
  if (scope !== undefined) upsertInput.scope = scope
  if (schemaFrequency !== undefined) upsertInput.schemaFrequency = schemaFrequency
  await deps.upsertConfig(upsertInput)

  return { ok: true }
}

// Re-exporting for callers that want to validate against the raw map.
export { TIER_CAPABILITIES }
