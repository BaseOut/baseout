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

const ALLOWED_BODY_KEYS = new Set(['frequency', 'storageType'])
const ALL_FREQUENCIES: ReadonlySet<Frequency> = new Set([
  'monthly',
  'weekly',
  'daily',
  'instant',
])
// MVP: only r2_managed accepted. Add BYOS values when the BYOS picker ships.
const ALLOWED_STORAGE_TYPES = new Set(['r2_managed'])

export interface PersistBackupConfigPolicyInput {
  spaceId: string
  body: Record<string, unknown>
  tier: Tier | null
}

export interface UpsertConfigInput {
  spaceId: string
  frequency?: Frequency
  storageType?: string
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

  // 4. Reject empty bodies (no-op upsert).
  if (frequency === undefined && storageType === undefined) {
    return { ok: false, error: 'invalid_request' }
  }

  // 5. Tier-gate the frequency. Unknown tier falls back to starter caps.
  if (frequency !== undefined) {
    const caps = getTierCapabilities(input.tier)
    if (!caps.frequencies.includes(frequency)) {
      return { ok: false, error: 'frequency_not_allowed' }
    }
  }

  // 6. Dispatch the upsert. Only include the fields actually present in
  //    the body; the route's upsert dep does the partial UPDATE/INSERT.
  const upsertInput: UpsertConfigInput = { spaceId: input.spaceId }
  if (frequency !== undefined) upsertInput.frequency = frequency
  if (storageType !== undefined) upsertInput.storageType = storageType
  await deps.upsertConfig(upsertInput)

  return { ok: true }
}

// Re-exporting for callers that want to validate against the raw map.
export { TIER_CAPABILITIES }
