/**
 * Override validation — pure (shared-entitlements task 2.4).
 *
 * A staff override must (a) carry a value whose shape matches the feature's
 * value_type, (b) be a valid member of the enum ladder / a sane limit, and
 * (c) include a non-empty reason (every override records WHO set WHAT and WHY,
 * design D2). This is the shared validation contract the admin override route
 * (admin-entitlements 3.2) and the apps/web write lib both run before persisting
 * — server-side validation, never trusting the client (CLAUDE.md §3.3).
 */

import {
  enumRank,
  toValueColumns,
  type FeatureValueType,
  type TypedValue,
  type ValueColumns,
} from './values'

export interface OverrideFeatureDef {
  valueType: FeatureValueType
  enumValues?: readonly string[] | null
}

export interface OverrideDraft {
  value: TypedValue
  reason: string
}

export type OverrideValidation =
  | { ok: true; columns: ValueColumns }
  | { ok: false; error: string }

export function validateOverrideValue(
  feature: OverrideFeatureDef,
  draft: OverrideDraft,
): OverrideValidation {
  if (!draft.reason || draft.reason.trim().length === 0) {
    return { ok: false, error: 'a reason is required for an override' }
  }

  const v = draft.value
  if (v.type !== feature.valueType) {
    return { ok: false, error: `value type "${v.type}" does not match feature type "${feature.valueType}"` }
  }

  switch (v.type) {
    case 'limit':
      // null = fair use (unlimited); otherwise a finite, non-negative number.
      if (v.limit !== null && (!Number.isFinite(v.limit) || v.limit < 0)) {
        return { ok: false, error: `limit override must be null (fair use) or a non-negative number, got ${String(v.limit)}` }
      }
      break
    case 'enum': {
      const ladder = feature.enumValues ?? []
      try {
        enumRank(ladder, v.enum)
      } catch {
        return { ok: false, error: `enum override "${v.enum}" is not a valid ladder member [${ladder.join(', ')}]` }
      }
      break
    }
    case 'boolean':
      if (typeof v.bool !== 'boolean') {
        return { ok: false, error: 'boolean override must be true or false' }
      }
      break
  }

  return { ok: true, columns: toValueColumns(v) }
}

// ── Override write (the domain half of the staff write path) ──────────────────
//
// Pure + dependency-injected: `getFeature` + `upsertOverride` are supplied by
// the caller (apps/web master DB, or apps/admin mirror). Returns `{ ok }` so it
// drops straight into `runAudited(intent, () => applyOverrideWrite(...), deps)`
// — the audit intent/result rows are written by runAudited, keeping overrides on
// the same single audited-mutation door as every other staff action.

export interface OverrideWriteInput {
  organizationId: string
  featureSlug: string
  value: TypedValue
  reason: string
  grantedByUserId?: string | null
  expiresAt?: Date | null
}

export interface OverrideUpsert {
  organizationId: string
  featureSlug: string
  columns: ValueColumns
  reason: string
  grantedByUserId: string | null
  expiresAt: Date | null
}

export interface OverrideWriteDeps {
  getFeature: (slug: string) => Promise<OverrideFeatureDef | null>
  upsertOverride: (row: OverrideUpsert) => Promise<void>
}

export type OverrideWriteResult =
  | { ok: true }
  | { ok: false; code: 'unknown_feature' | 'invalid_value'; error: string }

export async function applyOverrideWrite(
  deps: OverrideWriteDeps,
  input: OverrideWriteInput,
): Promise<OverrideWriteResult> {
  const feature = await deps.getFeature(input.featureSlug)
  if (!feature) {
    return { ok: false, code: 'unknown_feature', error: `unknown feature "${input.featureSlug}"` }
  }

  const validation = validateOverrideValue(feature, { value: input.value, reason: input.reason })
  if (!validation.ok) {
    return { ok: false, code: 'invalid_value', error: validation.error }
  }

  await deps.upsertOverride({
    organizationId: input.organizationId,
    featureSlug: input.featureSlug,
    columns: validation.columns,
    reason: input.reason,
    grantedByUserId: input.grantedByUserId ?? null,
    expiresAt: input.expiresAt ?? null,
  })
  return { ok: true }
}
