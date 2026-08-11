import { describe, expect, it } from 'vitest'
import {
  composeEntitlements,
  getBool,
  getEnum,
  getLimit,
  isActiveAddon,
  isActiveOverride,
  isWithinLimit,
  type AddonInput,
  type ComposeInput,
  type FeatureDef,
  type OverrideInput,
  type PlanFeatureInput,
} from '../src/entitlements/resolve'

const NOW = new Date('2026-08-04T00:00:00Z')
const FUTURE = new Date('2027-01-01T00:00:00Z')
const PAST = new Date('2026-01-01T00:00:00Z')

const FREQUENCY = ['one_time', 'monthly', 'weekly', 'daily', 'instant']

// A small catalog: one limit, one enum, one boolean feature.
const FEATURES: FeatureDef[] = [
  { slug: 'spaces', valueType: 'limit', meterable: true, meterKind: 'creation' },
  { slug: 'restores_monthly', valueType: 'limit', meterable: true, meterKind: 'flow' },
  { slug: 'backup_frequency_max', valueType: 'enum', enumValues: FREQUENCY },
  { slug: 'byo_ai_key', valueType: 'boolean' },
]

const lim = (featureSlug: string, n: number | null): PlanFeatureInput => ({
  featureSlug, valueBool: null, valueNumeric: n, valueEnum: null,
})
const en = (featureSlug: string, v: string): PlanFeatureInput => ({
  featureSlug, valueBool: null, valueNumeric: null, valueEnum: v,
})
const boolean = (featureSlug: string, b: boolean): PlanFeatureInput => ({
  featureSlug, valueBool: b, valueNumeric: null, valueEnum: null,
})

// Core plan values.
const PLAN: PlanFeatureInput[] = [
  lim('spaces', 10),
  lim('restores_monthly', 10),
  en('backup_frequency_max', 'weekly'),
  boolean('byo_ai_key', false),
]

function compose(partial: Partial<ComposeInput>) {
  return composeEntitlements({ features: FEATURES, planFeatures: PLAN, now: NOW, ...partial })
}

describe('plan value only (no override, no add-on)', () => {
  const map = compose({})
  it('resolves each feature to its plan value', () => {
    expect(getLimit(map, 'spaces')).toBe(10)
    expect(getEnum(map, 'backup_frequency_max')).toBe('weekly')
    expect(getBool(map, 'byo_ai_key')).toBe(false)
    expect(map.spaces.overrideValue).toBeNull()
    expect(map.spaces.addonBonus).toBe(0)
  })
})

describe('overrides replace the plan value (may raise or lower)', () => {
  it('a limit override replaces the plan limit', () => {
    const overrides: OverrideInput[] = [{ featureSlug: 'spaces', valueBool: null, valueNumeric: 25, valueEnum: null }]
    const map = compose({ overrides })
    expect(getLimit(map, 'spaces')).toBe(25)
    expect(map.spaces.overrideValue).toEqual({ type: 'limit', limit: 25 })
  })

  it('a boolean override flips the gate on', () => {
    const overrides: OverrideInput[] = [{ featureSlug: 'byo_ai_key', valueBool: true, valueNumeric: null, valueEnum: null }]
    expect(getBool(compose({ overrides }), 'byo_ai_key')).toBe(true)
  })

  it('an enum override replaces the ladder member (even downward)', () => {
    const overrides: OverrideInput[] = [{ featureSlug: 'backup_frequency_max', valueBool: null, valueNumeric: null, valueEnum: 'monthly' }]
    expect(getEnum(compose({ overrides }), 'backup_frequency_max')).toBe('monthly')
  })

  it('an expired override is ignored → plan value', () => {
    const overrides: OverrideInput[] = [{ featureSlug: 'spaces', valueBool: null, valueNumeric: 25, valueEnum: null, expiresAt: PAST }]
    const map = compose({ overrides })
    expect(getLimit(map, 'spaces')).toBe(10)
    expect(map.spaces.overrideValue).toBeNull()
  })

  it('a future-dated override still applies', () => {
    const overrides: OverrideInput[] = [{ featureSlug: 'spaces', valueBool: null, valueNumeric: 25, valueEnum: null, expiresAt: FUTURE }]
    expect(getLimit(compose({ overrides }), 'spaces')).toBe(25)
  })
})

describe('add-on stacking (limit features only)', () => {
  it('stacks quantity × unit_quantity on top of the plan limit', () => {
    const addons: AddonInput[] = [{ featureSlug: 'spaces', unitQuantity: 1, quantity: 3, status: 'active' }]
    const map = compose({ addons })
    expect(getLimit(map, 'spaces')).toBe(13) // 10 + 3×1
    expect(map.spaces.addonBonus).toBe(3)
  })

  it('sums multiple add-on purchases for the same feature', () => {
    const addons: AddonInput[] = [
      { featureSlug: 'spaces', unitQuantity: 1, quantity: 2, status: 'active' },
      { featureSlug: 'spaces', unitQuantity: 1, quantity: 1, status: 'active' },
    ]
    expect(getLimit(compose({ addons }), 'spaces')).toBe(13)
  })

  it('stacks on top of an override base, not the plan', () => {
    const overrides: OverrideInput[] = [{ featureSlug: 'spaces', valueBool: null, valueNumeric: 25, valueEnum: null }]
    const addons: AddonInput[] = [{ featureSlug: 'spaces', unitQuantity: 1, quantity: 2, status: 'active' }]
    expect(getLimit(compose({ overrides, addons }), 'spaces')).toBe(27) // 25 + 2
  })

  it('fair use (null) absorbs add-ons — stays unlimited', () => {
    const planFeatures = [...PLAN.filter((p) => p.featureSlug !== 'restores_monthly'), lim('restores_monthly', null)]
    const addons: AddonInput[] = [{ featureSlug: 'restores_monthly', unitQuantity: 3, quantity: 5, status: 'active' }]
    const map = composeEntitlements({ features: FEATURES, planFeatures, addons, now: NOW })
    expect(getLimit(map, 'restores_monthly')).toBeNull()
  })

  it('does NOT stack on enum or boolean features', () => {
    const addons: AddonInput[] = [
      { featureSlug: 'backup_frequency_max', unitQuantity: 1, quantity: 5, status: 'active' },
      { featureSlug: 'byo_ai_key', unitQuantity: 1, quantity: 5, status: 'active' },
    ]
    const map = compose({ addons })
    expect(getEnum(map, 'backup_frequency_max')).toBe('weekly')
    expect(getBool(map, 'byo_ai_key')).toBe(false)
    expect(map.backup_frequency_max.addonBonus).toBe(0)
  })

  it('excludes cancelled and expired add-ons', () => {
    const addons: AddonInput[] = [
      { featureSlug: 'spaces', unitQuantity: 1, quantity: 5, status: 'cancelled' },
      { featureSlug: 'spaces', unitQuantity: 1, quantity: 5, status: 'active', expiresAt: PAST },
      { featureSlug: 'spaces', unitQuantity: 1, quantity: 2, status: 'active', expiresAt: FUTURE },
    ]
    expect(getLimit(compose({ addons }), 'spaces')).toBe(12) // only the 2 active/unexpired
  })
})

describe('active-state helpers', () => {
  it('isActiveOverride respects expiry', () => {
    expect(isActiveOverride({ expiresAt: null }, NOW)).toBe(true)
    expect(isActiveOverride({ expiresAt: FUTURE }, NOW)).toBe(true)
    expect(isActiveOverride({ expiresAt: PAST }, NOW)).toBe(false)
  })
  it('isActiveAddon respects status and expiry', () => {
    expect(isActiveAddon({ status: 'active' }, NOW)).toBe(true)
    expect(isActiveAddon({ status: 'cancelled' }, NOW)).toBe(false)
    expect(isActiveAddon({ status: 'active', expiresAt: PAST }, NOW)).toBe(false)
  })
})

describe('accessors and guards', () => {
  const map = compose({})
  it('isWithinLimit compares proposed usage', () => {
    expect(isWithinLimit(map, 'spaces', 10)).toBe(true)
    expect(isWithinLimit(map, 'spaces', 11)).toBe(false)
  })
  it('fair use is always within limit', () => {
    const planFeatures = [...PLAN.filter((p) => p.featureSlug !== 'restores_monthly'), lim('restores_monthly', null)]
    const m = composeEntitlements({ features: FEATURES, planFeatures, now: NOW })
    expect(isWithinLimit(m, 'restores_monthly', 9_999_999)).toBe(true)
  })
  it('throws on type mismatch and missing features', () => {
    expect(() => getLimit(map, 'byo_ai_key')).toThrow(/not a limit/)
    expect(() => getBool(map, 'spaces')).toThrow(/not a boolean/)
    expect(() => getEnum(map, 'spaces')).toThrow(/not an enum/)
    expect(() => getLimit(map, 'nonexistent')).toThrow(/not resolved/)
  })
})
