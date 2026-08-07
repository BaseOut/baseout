/**
 * External-destinations creation-cap gate (shared-entitlements 4.3). DI core tested
 * with fakes; the OAuth callbacks assemble the real deps (space→org resolution +
 * a per-org distinct-external count that excludes the (space,type) being connected,
 * so re-connecting an existing provider is a replace, not a new destination).
 */

import { describe, expect, it, vi } from 'vitest'
import { decideDestinationCap, type DestinationCapDeps } from './enforce-destination'
import type { EntitlementMap, ResolvedFeature } from '@baseout/db-schema'

const SPACE = 'space_1'
const ORG = 'org_1'

function destinationsLimit(limit: number): EntitlementMap {
  const feature: ResolvedFeature = {
    slug: 'snapshot_destinations_external',
    valueType: 'limit',
    enumValues: null,
    meterable: true,
    meterKind: 'creation',
    planValue: { type: 'limit', limit },
    overrideValue: null,
    addonBonus: 0,
    effective: { type: 'limit', limit },
  }
  return { snapshot_destinations_external: feature }
}

function makeDeps(overrides: Partial<DestinationCapDeps> = {}): DestinationCapDeps {
  return {
    enforcementEnabled: true,
    resolveOrgForSpace: vi.fn(async () => ORG),
    resolveEntitlements: vi.fn(async () => ({ entitlements: destinationsLimit(1) })),
    countExternalExcluding: vi.fn(async () => 0),
    ...overrides,
  }
}

describe('decideDestinationCap', () => {
  it('flag OFF → allowed, and touches nothing (dark)', async () => {
    const deps = makeDeps({ enforcementEnabled: false })
    const d = await decideDestinationCap(SPACE, 'google_drive', deps)
    expect(d.allowed).toBe(true)
    expect(deps.resolveOrgForSpace).not.toHaveBeenCalled()
    expect(deps.resolveEntitlements).not.toHaveBeenCalled()
    expect(deps.countExternalExcluding).not.toHaveBeenCalled()
  })

  it('flag ON, space has no org → allowed (fail open), never counts', async () => {
    const countExternalExcluding = vi.fn(async () => 99)
    const deps = makeDeps({
      resolveOrgForSpace: vi.fn(async () => null),
      countExternalExcluding,
    })
    const d = await decideDestinationCap(SPACE, 'box', deps)
    expect(d.allowed).toBe(true)
    expect(countExternalExcluding).not.toHaveBeenCalled()
  })

  it('flag ON, under the cap → allowed; counts excluding this (space,type)', async () => {
    const countExternalExcluding = vi.fn(async () => 0)
    const deps = makeDeps({
      resolveEntitlements: vi.fn(async () => ({ entitlements: destinationsLimit(1) })),
      countExternalExcluding,
    })
    const d = await decideDestinationCap(SPACE, 'dropbox', deps)
    expect(d.allowed).toBe(true)
    expect(countExternalExcluding).toHaveBeenCalledWith(ORG, SPACE, 'dropbox')
  })

  it('flag ON, at the cap (a new external type) → blocked with the add-on hint', async () => {
    const deps = makeDeps({
      resolveEntitlements: vi.fn(async () => ({ entitlements: destinationsLimit(1) })),
      countExternalExcluding: vi.fn(async () => 1), // one OTHER external already exists
    })
    const d = await decideDestinationCap(SPACE, 'onedrive', deps)
    expect(d).toMatchObject({
      allowed: false,
      featureSlug: 'snapshot_destinations_external',
      used: 1,
      limit: 1,
      addonSlug: 'destinations_1',
    })
  })

  it('re-connecting an existing provider passes even at the cap (excluded from the count)', async () => {
    // The wrapper excludes the current (space,type); so on a Lite org at its cap of 1,
    // re-connecting the SAME destination yields count 0 → allowed.
    const deps = makeDeps({
      resolveEntitlements: vi.fn(async () => ({ entitlements: destinationsLimit(1) })),
      countExternalExcluding: vi.fn(async () => 0),
    })
    const d = await decideDestinationCap(SPACE, 'google_drive', deps)
    expect(d.allowed).toBe(true)
  })
})
