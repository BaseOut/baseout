import { describe, expect, it } from 'vitest'
import {
  canCreate,
  summarizeCreationUsage,
} from '../src/entitlements/creation-usage'
import type { EntitlementMap, ResolvedFeature } from '../src/entitlements/resolve'
import type { MeterKind } from '../src/entitlements/values'

// ── Test fixtures: build a minimal resolved entitlement map ──

function limitFeature(
  slug: string,
  limit: number | null,
  meterKind: MeterKind = 'creation',
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

function boolFeature(slug: string, bool: boolean): ResolvedFeature {
  return {
    slug,
    valueType: 'boolean',
    enumValues: null,
    meterable: false,
    meterKind: null,
    planValue: { type: 'boolean', bool },
    overrideValue: null,
    addonBonus: 0,
    effective: { type: 'boolean', bool },
  }
}

function mapOf(...features: ResolvedFeature[]): EntitlementMap {
  const map: EntitlementMap = {}
  for (const f of features) map[f.slug] = f
  return map
}

describe('summarizeCreationUsage — read-path for creation caps (no stored rollups)', () => {
  it('includes only creation-class limit features (skips stock/flow limits and booleans)', () => {
    const entitlements = mapOf(
      limitFeature('spaces', 10, 'creation'),
      limitFeature('records_under_management', 750_000, 'stock'),
      limitFeature('monthly_call_allowance', 50_000, 'flow'),
      boolFeature('byo_ai_key', true),
    )
    const summary = summarizeCreationUsage({ entitlements, counts: { spaces: 3 } })
    expect(summary.map((s) => s.featureSlug)).toEqual(['spaces'])
  })

  it('computes used/limit/remaining/withinLimit/pct under the cap', () => {
    const entitlements = mapOf(limitFeature('spaces', 10))
    const [s] = summarizeCreationUsage({ entitlements, counts: { spaces: 3 } })
    expect(s).toMatchObject({
      featureSlug: 'spaces',
      used: 3,
      limit: 10,
      remaining: 7,
      withinLimit: true,
      pct: 0.3,
    })
  })

  it('at the cap: withinLimit true, remaining 0, pct 1', () => {
    const entitlements = mapOf(limitFeature('bases_under_management', 50))
    const [s] = summarizeCreationUsage({
      entitlements,
      counts: { bases_under_management: 50 },
    })
    expect(s).toMatchObject({ used: 50, remaining: 0, withinLimit: true, pct: 1 })
  })

  it('over the cap: withinLimit false, remaining clamped to 0', () => {
    const entitlements = mapOf(limitFeature('active_reports', 5))
    const [s] = summarizeCreationUsage({ entitlements, counts: { active_reports: 7 } })
    expect(s).toMatchObject({ used: 7, remaining: 0, withinLimit: false })
    expect(s.pct).toBeCloseTo(1.4)
  })

  it('a missing count defaults to 0', () => {
    const entitlements = mapOf(limitFeature('seats', 5))
    const [s] = summarizeCreationUsage({ entitlements, counts: {} })
    expect(s).toMatchObject({ used: 0, remaining: 5, withinLimit: true, pct: 0 })
  })

  it('fair use (null limit) is always within, unlimited remaining, pct 0', () => {
    const entitlements = mapOf(limitFeature('spaces', null))
    const [s] = summarizeCreationUsage({ entitlements, counts: { spaces: 999 } })
    expect(s).toMatchObject({
      limit: null,
      remaining: null,
      withinLimit: true,
      pct: 0,
    })
  })

  it('returns features sorted by slug for a deterministic payload', () => {
    const entitlements = mapOf(
      limitFeature('spaces', 10),
      limitFeature('bases_under_management', 50),
      limitFeature('seats', 5),
    )
    const summary = summarizeCreationUsage({ entitlements, counts: {} })
    expect(summary.map((s) => s.featureSlug)).toEqual([
      'bases_under_management',
      'seats',
      'spaces',
    ])
  })
})

describe('canCreate — one-more-slot gate for create-time enforcement', () => {
  it('allows creation strictly under the cap', () => {
    const entitlements = mapOf(limitFeature('spaces', 3))
    expect(canCreate(entitlements, 'spaces', 2)).toBe(true)
  })

  it('blocks creation at the cap (used >= limit)', () => {
    const entitlements = mapOf(limitFeature('spaces', 3))
    expect(canCreate(entitlements, 'spaces', 3)).toBe(false)
  })

  it('blocks creation over the cap', () => {
    const entitlements = mapOf(limitFeature('spaces', 3))
    expect(canCreate(entitlements, 'spaces', 5)).toBe(false)
  })

  it('a zero limit blocks the first creation', () => {
    const entitlements = mapOf(limitFeature('active_reports', 0))
    expect(canCreate(entitlements, 'active_reports', 0)).toBe(false)
  })

  it('fair use (null limit) always allows creation', () => {
    const entitlements = mapOf(limitFeature('spaces', null))
    expect(canCreate(entitlements, 'spaces', 10_000)).toBe(true)
  })

  it('fails open when the feature is not a resolved limit (absent / wrong type)', () => {
    const entitlements = mapOf(boolFeature('byo_ai_key', false))
    expect(canCreate(entitlements, 'byo_ai_key', 99)).toBe(true) // not a limit → allow
    expect(canCreate(entitlements, 'not_in_plan', 99)).toBe(true) // absent → allow
  })
})
