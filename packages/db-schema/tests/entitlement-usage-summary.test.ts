import { describe, expect, it } from 'vitest'
import { buildUsageSummary } from '../src/entitlements/usage-summary'
import type { EntitlementMap, ResolvedFeature } from '../src/entitlements/resolve'
import type { MeterKind } from '../src/entitlements/values'

function limitFeature(
  slug: string,
  limit: number | null,
  meterKind: MeterKind,
): ResolvedFeature {
  return {
    slug,
    valueType: 'limit',
    enumValues: null,
    meterable: true,
    meterKind,
    planValue: { type: 'limit', limit },
    overrideValue: null,
    addonBonus: 0,
    effective: { type: 'limit', limit },
  }
}

function boolFeature(slug: string): ResolvedFeature {
  return {
    slug,
    valueType: 'boolean',
    enumValues: null,
    meterable: false,
    meterKind: null,
    planValue: { type: 'boolean', bool: true },
    overrideValue: null,
    addonBonus: 0,
    effective: { type: 'boolean', bool: true },
  }
}

function mapOf(...features: ResolvedFeature[]): EntitlementMap {
  const map: EntitlementMap = {}
  for (const f of features) map[f.slug] = f
  return map
}

describe('buildUsageSummary — unified meter payload for the usage endpoint', () => {
  it('reports stock/flow meters from rollups (absent → 0) with pct/remaining/withinLimit', () => {
    const entitlements = mapOf(
      limitFeature('records_under_management', 1000, 'stock'),
      limitFeature('monthly_call_allowance', 200, 'flow'),
    )
    const meters = buildUsageSummary({
      entitlements,
      creationCounts: {},
      rollups: { records_under_management: 900 },
    })
    expect(meters).toEqual([
      {
        featureSlug: 'monthly_call_allowance',
        meterKind: 'flow',
        used: 0,
        limit: 200,
        remaining: 200,
        withinLimit: true,
        pct: 0,
      },
      {
        featureSlug: 'records_under_management',
        meterKind: 'stock',
        used: 900,
        limit: 1000,
        remaining: 100,
        withinLimit: true,
        pct: 0.9,
      },
    ])
  })

  it('reports creation meters with a live count, and null-usage for ones not counted in this scope', () => {
    const entitlements = mapOf(
      limitFeature('spaces', 10, 'creation'),
      limitFeature('documents', 25, 'creation'), // not countable in web scope
    )
    const meters = buildUsageSummary({
      entitlements,
      creationCounts: { spaces: 4 },
      rollups: {},
    })
    const bySlug = Object.fromEntries(meters.map((m) => [m.featureSlug, m]))
    expect(bySlug.spaces).toMatchObject({ used: 4, limit: 10, remaining: 6, withinLimit: true })
    // Not counted here → used null, treated as within (don't false-flag), remaining null.
    expect(bySlug.documents).toMatchObject({
      used: null,
      limit: 25,
      remaining: null,
      withinLimit: true,
      pct: 0,
    })
  })

  it('excludes non-metered features (booleans/enums) and non-meterable limits', () => {
    const entitlements = mapOf(
      limitFeature('spaces', 10, 'creation'),
      boolFeature('byo_ai_key'),
    )
    const meters = buildUsageSummary({ entitlements, creationCounts: { spaces: 1 }, rollups: {} })
    expect(meters.map((m) => m.featureSlug)).toEqual(['spaces'])
  })

  it('fair-use (null limit) → remaining null, withinLimit true, pct 0', () => {
    const entitlements = mapOf(limitFeature('restores_monthly', null, 'flow'))
    const [m] = buildUsageSummary({
      entitlements,
      creationCounts: {},
      rollups: { restores_monthly: 40 },
    })
    expect(m).toMatchObject({ used: 40, limit: null, remaining: null, withinLimit: true, pct: 0 })
  })

  it('over a stock limit → withinLimit false, remaining clamped to 0', () => {
    const entitlements = mapOf(limitFeature('records_under_management', 1000, 'stock'))
    const [m] = buildUsageSummary({
      entitlements,
      creationCounts: {},
      rollups: { records_under_management: 1500 },
    })
    expect(m).toMatchObject({ used: 1500, remaining: 0, withinLimit: false })
    expect(m.pct).toBeCloseTo(1.5)
  })

  it('sorts meters by slug for a deterministic payload', () => {
    const entitlements = mapOf(
      limitFeature('spaces', 10, 'creation'),
      limitFeature('ai_credits_monthly', 200, 'flow'),
      limitFeature('records_under_management', 1000, 'stock'),
    )
    const meters = buildUsageSummary({ entitlements, creationCounts: { spaces: 0 }, rollups: {} })
    expect(meters.map((m) => m.featureSlug)).toEqual([
      'ai_credits_monthly',
      'records_under_management',
      'spaces',
    ])
  })
})
