/**
 * Create-time creation-cap enforcement — DI logic (shared-entitlements task 4.3,
 * creation-cap subset). Unit-tested with fakes; no DB. The route assembles real
 * deps (resolveEntitlements + a live COUNT(*)).
 */

import { describe, expect, it, vi } from 'vitest'
import { checkCreationCap, type CreationCapDeps } from './enforce-create'
import type { EntitlementMap, ResolvedFeature } from '@baseout/db-schema'

const ORG = 'org_1'

function spacesLimit(limit: number | null): EntitlementMap {
  const feature: ResolvedFeature = {
    slug: 'spaces',
    valueType: 'limit',
    enumValues: null,
    meterable: true,
    meterKind: 'creation',
    planValue: { type: 'limit', limit },
    overrideValue: null,
    addonBonus: 0,
    effective: { type: 'limit', limit },
  }
  return { spaces: feature }
}

function makeDeps(overrides: Partial<CreationCapDeps> = {}): CreationCapDeps {
  return {
    enforcementEnabled: true,
    resolveEntitlements: vi.fn(async () => ({ entitlements: spacesLimit(3) })),
    count: vi.fn(async () => 0),
    ...overrides,
  }
}

describe('checkCreationCap', () => {
  it('flag OFF → allowed, and never resolves or counts (dark, zero overhead)', async () => {
    const deps = makeDeps({ enforcementEnabled: false })
    const decision = await checkCreationCap(ORG, 'spaces', deps)
    expect(decision.allowed).toBe(true)
    expect(deps.resolveEntitlements).not.toHaveBeenCalled()
    expect(deps.count).not.toHaveBeenCalled()
  })

  it('flag ON, under the cap → allowed with used + limit', async () => {
    const deps = makeDeps({
      resolveEntitlements: vi.fn(async () => ({ entitlements: spacesLimit(3) })),
      count: vi.fn(async () => 2),
    })
    const decision = await checkCreationCap(ORG, 'spaces', deps)
    expect(decision).toMatchObject({ allowed: true, used: 2, limit: 3 })
  })

  it('flag ON, at the cap → blocked with used, limit, and the add-on hint', async () => {
    const deps = makeDeps({
      resolveEntitlements: vi.fn(async () => ({ entitlements: spacesLimit(3) })),
      count: vi.fn(async () => 3),
    })
    const decision = await checkCreationCap(ORG, 'spaces', deps)
    expect(decision).toMatchObject({
      allowed: false,
      featureSlug: 'spaces',
      used: 3,
      limit: 3,
      addonSlug: 'spaces_1',
    })
  })

  it('flag ON, over the cap → blocked', async () => {
    const deps = makeDeps({ count: vi.fn(async () => 9) })
    const decision = await checkCreationCap(ORG, 'spaces', deps)
    expect(decision.allowed).toBe(false)
  })

  it('flag ON but no active plan (resolve → null) → allowed (fail open), never counts', async () => {
    const count = vi.fn(async () => 99)
    const deps = makeDeps({ resolveEntitlements: vi.fn(async () => null), count })
    const decision = await checkCreationCap(ORG, 'spaces', deps)
    expect(decision.allowed).toBe(true)
    expect(count).not.toHaveBeenCalled()
  })

  it('flag ON, fair-use (null) limit → allowed regardless of count', async () => {
    const deps = makeDeps({
      resolveEntitlements: vi.fn(async () => ({ entitlements: spacesLimit(null) })),
      count: vi.fn(async () => 10_000),
    })
    const decision = await checkCreationCap(ORG, 'spaces', deps)
    expect(decision).toMatchObject({ allowed: true, limit: null })
  })
})
