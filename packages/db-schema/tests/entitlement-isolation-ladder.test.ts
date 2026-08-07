import { describe, expect, it } from 'vitest'
import { composeEntitlements, type FeatureDef, type PlanFeatureInput } from '../src/entitlements/resolve'
import { allowedIsolationClasses, refuseAboveCeiling } from '../src/entitlements/isolation-ladder'

const NOW = new Date('2026-08-07T00:00:00Z')

// The isolation ladder, ordered ascending. Lives on the resolved feature's
// enumValues so the module reads it data-driven rather than hardcoding.
const LADDER = ['d1', 'shared_cluster', 'dedicated_cluster', 'byodb']

const FEATURES: FeatureDef[] = [
  { slug: 'database_isolation_class', valueType: 'enum', enumValues: LADDER },
]

const en = (featureSlug: string, v: string): PlanFeatureInput => ({
  featureSlug,
  valueBool: null,
  valueNumeric: null,
  valueEnum: v,
})

// Build an EntitlementMap whose ceiling for database_isolation_class is `ceiling`.
function mapWithCeiling(ceiling: string) {
  return composeEntitlements({
    features: FEATURES,
    planFeatures: [en('database_isolation_class', ceiling)],
    now: NOW,
  })
}

describe('allowedIsolationClasses', () => {
  it('Lite ceiling (d1) allows only d1', () => {
    expect(allowedIsolationClasses(mapWithCeiling('d1'))).toEqual(['d1'])
  })

  it('Plus ceiling (dedicated_cluster) allows d1 through dedicated_cluster in ladder order', () => {
    expect(allowedIsolationClasses(mapWithCeiling('dedicated_cluster'))).toEqual([
      'd1',
      'shared_cluster',
      'dedicated_cluster',
    ])
  })

  it('Max ceiling (byodb) allows all four ladder members', () => {
    expect(allowedIsolationClasses(mapWithCeiling('byodb'))).toEqual([
      'd1',
      'shared_cluster',
      'dedicated_cluster',
      'byodb',
    ])
  })

  it('throws when the feature is not resolved', () => {
    const empty = composeEntitlements({ features: [], planFeatures: [], now: NOW })
    expect(() => allowedIsolationClasses(empty)).toThrow(/not resolved/)
  })
})

describe('refuseAboveCeiling', () => {
  it('Lite ceiling (d1) refuses shared_cluster', () => {
    expect(refuseAboveCeiling('shared_cluster', mapWithCeiling('d1'))).toEqual({
      allowed: false,
      ceiling: 'd1',
      requested: 'shared_cluster',
    })
  })

  it('Plus ceiling (dedicated_cluster) refuses byodb', () => {
    expect(refuseAboveCeiling('byodb', mapWithCeiling('dedicated_cluster'))).toEqual({
      allowed: false,
      ceiling: 'dedicated_cluster',
      requested: 'byodb',
    })
  })

  it('Plus ceiling (dedicated_cluster) allows shared_cluster (below ceiling)', () => {
    expect(refuseAboveCeiling('shared_cluster', mapWithCeiling('dedicated_cluster'))).toEqual({
      allowed: true,
      ceiling: 'dedicated_cluster',
      requested: 'shared_cluster',
    })
  })

  it('requested == ceiling is allowed', () => {
    expect(refuseAboveCeiling('dedicated_cluster', mapWithCeiling('dedicated_cluster'))).toEqual({
      allowed: true,
      ceiling: 'dedicated_cluster',
      requested: 'dedicated_cluster',
    })
  })

  it('Max ceiling (byodb) allows byodb', () => {
    expect(refuseAboveCeiling('byodb', mapWithCeiling('byodb'))).toEqual({
      allowed: true,
      ceiling: 'byodb',
      requested: 'byodb',
    })
  })

  it('throws on an unknown requested class', () => {
    expect(() => refuseAboveCeiling('quantum_cluster', mapWithCeiling('byodb'))).toThrow(
      /not in ladder/,
    )
  })
})
