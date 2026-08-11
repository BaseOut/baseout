import { describe, it, expect } from 'vitest'
import { composeEntitlements, toValueColumns, type EntitlementMap } from '@baseout/db-schema'
import { FEATURES, type PlanSlug } from '../../db/seed/entitlements-catalog'
import { entitlementsToCapabilities } from './entitlement-capabilities'

const NOW = new Date('2026-08-04T00:00:00.000Z')

/** Compose the real effective entitlement map for a seeded plan (+ optional add-ons). */
function entitlementsForPlan(
  plan: PlanSlug,
  addons: Array<{ featureSlug: string; unitQuantity: number; quantity: number }> = [],
): EntitlementMap {
  return composeEntitlements({
    features: FEATURES.map((f) => ({
      slug: f.slug,
      valueType: f.valueType,
      enumValues: f.enumValues ?? null,
      meterable: f.meterable ?? false,
      meterKind: f.meterKind ?? null,
    })),
    planFeatures: FEATURES.map((f) => ({ featureSlug: f.slug, ...toValueColumns(f.values[plan]) })),
    addons: addons.map((a) => ({ ...a, status: 'active', expiresAt: null })),
    now: NOW,
  })
}

describe('entitlementsToCapabilities — per seeded plan', () => {
  it('lite: monthly only, docs manual, org-wide 15 bases, moot poll floor', () => {
    expect(entitlementsToCapabilities(entitlementsForPlan('lite'))).toEqual({
      basesPerSpace: 15,
      frequencies: ['monthly'],
      schemaDocs: 'manual',
      webhookPollMinSeconds: 900,
    })
  })

  it('core: up to weekly, docs manual, 50 bases', () => {
    expect(entitlementsToCapabilities(entitlementsForPlan('core'))).toEqual({
      basesPerSpace: 50,
      frequencies: ['monthly', 'weekly'],
      schemaDocs: 'manual',
      webhookPollMinSeconds: 900,
    })
  })

  it('plus: up to daily (not instant), BYO-AI → manual_ai, 150 bases', () => {
    expect(entitlementsToCapabilities(entitlementsForPlan('plus'))).toEqual({
      basesPerSpace: 150,
      frequencies: ['monthly', 'weekly', 'daily'],
      schemaDocs: 'manual_ai',
      webhookPollMinSeconds: 900, // plus max cadence is daily → no instant polling
    })
  })

  it('max: instant, manual_ai, 500 bases, instant poll floor', () => {
    expect(entitlementsToCapabilities(entitlementsForPlan('max'))).toEqual({
      basesPerSpace: 500,
      frequencies: ['monthly', 'weekly', 'daily', 'instant'],
      schemaDocs: 'manual_ai',
      webhookPollMinSeconds: 300,
    })
  })

  it('trial: one_time only → NO scheduled cadences (a single one-off backup)', () => {
    expect(entitlementsToCapabilities(entitlementsForPlan('trial'))).toEqual({
      basesPerSpace: 15,
      frequencies: [],
      schemaDocs: 'manual',
      webhookPollMinSeconds: 900,
    })
  })

  it('enterprise (Max baseline): instant, manual_ai, 500 bases', () => {
    expect(entitlementsToCapabilities(entitlementsForPlan('enterprise'))).toEqual({
      basesPerSpace: 500,
      frequencies: ['monthly', 'weekly', 'daily', 'instant'],
      schemaDocs: 'manual_ai',
      webhookPollMinSeconds: 300,
    })
  })
})

describe('entitlementsToCapabilities — reads EFFECTIVE values (add-ons stack)', () => {
  it('a +3-bases add-on raises basesPerSpace above the plan value', () => {
    const caps = entitlementsToCapabilities(
      entitlementsForPlan('lite', [{ featureSlug: 'bases_under_management', unitQuantity: 3, quantity: 2 }]),
    )
    expect(caps.basesPerSpace).toBe(15 + 3 * 2) // 21 — proves it reads effective, not planValue
  })

  it('frequencies expand down the ladder inclusive of the max cadence', () => {
    // daily max ⇒ monthly, weekly, daily (order preserved), never instant
    expect(entitlementsToCapabilities(entitlementsForPlan('plus')).frequencies).toEqual([
      'monthly',
      'weekly',
      'daily',
    ])
  })
})
