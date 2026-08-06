/**
 * Usage-endpoint handler — DI logic (shared-entitlements task 9.1). Unit-tested
 * with fakes; the route assembles real deps (resolveEntitlements + live counts +
 * current-period rollup read).
 */

import { describe, expect, it, vi } from 'vitest'
import { buildUsageResponse, type UsageResponseDeps } from './usage-endpoint'
import type { EntitlementMap, ResolvedFeature } from '@baseout/db-schema'

const ORG = 'org_1'

function spacesLimit(limit: number): EntitlementMap {
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

function makeDeps(overrides: Partial<UsageResponseDeps> = {}): UsageResponseDeps {
  return {
    resolveEntitlements: vi.fn(async () => ({
      planSlug: 'lite',
      entitlements: spacesLimit(3),
    })),
    creationCounts: vi.fn(async () => ({ spaces: 2 })),
    readRollups: vi.fn(async () => ({})),
    ...overrides,
  }
}

describe('buildUsageResponse', () => {
  it('no active plan (resolve → null) → empty payload, and never reads usage', async () => {
    const creationCounts = vi.fn(async () => ({}))
    const readRollups = vi.fn(async () => ({}))
    const deps = makeDeps({
      resolveEntitlements: vi.fn(async () => null),
      creationCounts,
      readRollups,
    })
    const result = await buildUsageResponse(ORG, deps)
    expect(result).toEqual({ planSlug: null, meters: [] })
    expect(creationCounts).not.toHaveBeenCalled()
    expect(readRollups).not.toHaveBeenCalled()
  })

  it('assembles planSlug + meters from live counts and rollups', async () => {
    const deps = makeDeps({
      resolveEntitlements: vi.fn(async () => ({
        planSlug: 'lite',
        entitlements: spacesLimit(3),
      })),
      creationCounts: vi.fn(async () => ({ spaces: 2 })),
      readRollups: vi.fn(async () => ({})),
    })
    const result = await buildUsageResponse(ORG, deps)
    expect(result.planSlug).toBe('lite')
    expect(result.meters).toEqual([
      {
        featureSlug: 'spaces',
        meterKind: 'creation',
        used: 2,
        limit: 3,
        remaining: 1,
        withinLimit: true,
        pct: 2 / 3,
      },
    ])
    expect(deps.creationCounts).toHaveBeenCalledWith(ORG)
    expect(deps.readRollups).toHaveBeenCalledWith(ORG)
  })
})
