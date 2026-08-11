/**
 * Entitlement resolution — pure composition (shared-entitlements design D2/D9, task 2.1).
 *
 * The single deterministic rule, consumed identically by web, server, and admin:
 *
 *   effective(org, feature) =
 *     base = (active override.value ?? plan_features.value)
 *     effective = base + Σ active addon_purchases.quantity × addon.unit_quantity   (limit features only)
 *
 * Overrides REPLACE the plan value (they may raise or lower it); add-ons STACK on
 * top, and only on limit-type features. Fair-use (null limit) absorbs add-ons
 * (unlimited + anything = unlimited). Enum/boolean features never stack.
 *
 * This module is pure (no DB, no clock) — `now` is injected so expiry is
 * testable. The per-app query wrapper fetches the rows (org's plan_features,
 * overrides, active add-ons, feature catalog) and calls `composeEntitlements`.
 */

import {
  fromValueColumns,
  type FeatureValueType,
  type MeterKind,
  type TypedValue,
  type ValueColumns,
} from './values'

export interface FeatureDef {
  slug: string
  valueType: FeatureValueType
  enumValues?: readonly string[] | null
  meterable?: boolean
  meterKind?: MeterKind | null
}

export interface PlanFeatureInput extends ValueColumns {
  featureSlug: string
}

export interface OverrideInput extends ValueColumns {
  featureSlug: string
  expiresAt?: Date | string | null
}

export interface AddonInput {
  featureSlug: string
  unitQuantity: number
  quantity: number
  status: string
  expiresAt?: Date | string | null
}

export interface ResolvedFeature {
  slug: string
  valueType: FeatureValueType
  enumValues?: readonly string[] | null
  meterable: boolean
  meterKind: MeterKind | null
  planValue: TypedValue
  overrideValue: TypedValue | null // active override only
  addonBonus: number // Σ (quantity × unitQuantity), limits only
  effective: TypedValue
}

export type EntitlementMap = Record<string, ResolvedFeature>

export interface ComposeInput {
  features: FeatureDef[]
  planFeatures: PlanFeatureInput[]
  overrides?: OverrideInput[]
  addons?: AddonInput[]
  now: Date
}

function toTime(x: Date | string | null | undefined): number | null {
  if (x === null || x === undefined) return null
  return x instanceof Date ? x.getTime() : new Date(x).getTime()
}

/** An override applies unless it has expired. */
export function isActiveOverride(o: { expiresAt?: Date | string | null }, now: Date): boolean {
  const t = toTime(o.expiresAt)
  return t === null || t > now.getTime()
}

/** An add-on counts unless cancelled/expired (recurring: no expiry; one-time: expires_at). */
export function isActiveAddon(a: { status: string; expiresAt?: Date | string | null }, now: Date): boolean {
  if (a.status !== 'active') return false
  const t = toTime(a.expiresAt)
  return t === null || t > now.getTime()
}

/** Compose the full effective entitlement map for one organization. */
export function composeEntitlements(input: ComposeInput): EntitlementMap {
  const { features, planFeatures, overrides = [], addons = [], now } = input
  const planBySlug = new Map(planFeatures.map((p) => [p.featureSlug, p]))
  const map: EntitlementMap = {}

  for (const feature of features) {
    const pf = planBySlug.get(feature.slug)
    if (!pf) continue // feature not present in this plan — skip
    const planValue = fromValueColumns(feature.valueType, pf)

    const ov = overrides.find((o) => o.featureSlug === feature.slug && isActiveOverride(o, now))
    const overrideValue = ov ? fromValueColumns(feature.valueType, ov) : null

    const base = overrideValue ?? planValue

    let addonBonus = 0
    let effective = base
    if (feature.valueType === 'limit' && base.type === 'limit') {
      addonBonus = addons
        .filter((a) => a.featureSlug === feature.slug && isActiveAddon(a, now))
        .reduce((sum, a) => sum + a.quantity * a.unitQuantity, 0)
      // Fair use (null) absorbs any add-on; otherwise stack numerically.
      effective = base.limit === null ? base : { type: 'limit', limit: base.limit + addonBonus }
    }

    map[feature.slug] = {
      slug: feature.slug,
      valueType: feature.valueType,
      enumValues: feature.enumValues ?? null,
      meterable: feature.meterable ?? false,
      meterKind: feature.meterKind ?? null,
      planValue,
      overrideValue,
      addonBonus,
      effective,
    }
  }

  return map
}

// ── Typed accessors — callers read effective values without re-checking shapes ──

function mustGet(map: EntitlementMap, slug: string): ResolvedFeature {
  const r = map[slug]
  if (!r) throw new Error(`entitlement not resolved for feature "${slug}"`)
  return r
}

/** Effective limit; null = fair use / unlimited. Throws if the feature isn't a limit. */
export function getLimit(map: EntitlementMap, slug: string): number | null {
  const r = mustGet(map, slug)
  if (r.effective.type !== 'limit') throw new Error(`feature "${slug}" is not a limit`)
  return r.effective.limit
}

/** Effective boolean gate. Throws if the feature isn't a boolean. */
export function getBool(map: EntitlementMap, slug: string): boolean {
  const r = mustGet(map, slug)
  if (r.effective.type !== 'boolean') throw new Error(`feature "${slug}" is not a boolean`)
  return r.effective.bool
}

/** Effective enum member. Throws if the feature isn't an enum. */
export function getEnum(map: EntitlementMap, slug: string): string {
  const r = mustGet(map, slug)
  if (r.effective.type !== 'enum') throw new Error(`feature "${slug}" is not an enum`)
  return r.effective.enum
}

/**
 * Would `used` (proposed total) stay within the effective limit? Fair use is
 * always within. Used by enforcement/creation caps (`used <= limit`).
 */
export function isWithinLimit(map: EntitlementMap, slug: string, used: number): boolean {
  const limit = getLimit(map, slug)
  return limit === null || used <= limit
}
