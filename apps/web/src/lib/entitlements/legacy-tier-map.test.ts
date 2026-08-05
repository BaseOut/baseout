import { describe, expect, it } from 'vitest'
import { LEGACY_TIER_TO_PLAN_SLUG, legacyTierToPlanSlug } from './legacy-tier-map'

describe('legacyTierToPlanSlug', () => {
  it('maps the four public tiers by price alignment', () => {
    expect(legacyTierToPlanSlug('launch')).toBe('lite')
    expect(legacyTierToPlanSlug('growth')).toBe('core')
    expect(legacyTierToPlanSlug('pro')).toBe('plus')
    expect(legacyTierToPlanSlug('business')).toBe('max')
  })

  it('maps trial, the retired starter, and enterprise', () => {
    expect(legacyTierToPlanSlug('trial')).toBe('trial')
    expect(legacyTierToPlanSlug('starter')).toBe('lite')
    expect(legacyTierToPlanSlug('enterprise')).toBe('enterprise')
  })

  it('returns null for unknown / empty tiers (backfill skips them)', () => {
    expect(legacyTierToPlanSlug('mystery')).toBeNull()
    expect(legacyTierToPlanSlug(null)).toBeNull()
    expect(legacyTierToPlanSlug(undefined)).toBeNull()
    expect(legacyTierToPlanSlug('')).toBeNull()
  })

  it('every mapped target is a real plan slug', () => {
    const validPlanSlugs = new Set(['lite', 'core', 'plus', 'max', 'trial', 'enterprise'])
    for (const target of Object.values(LEGACY_TIER_TO_PLAN_SLUG)) {
      expect(validPlanSlugs.has(target)).toBe(true)
    }
  })
})
