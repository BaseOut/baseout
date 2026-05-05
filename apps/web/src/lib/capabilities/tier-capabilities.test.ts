import { describe, it, expect } from 'vitest'
import {
  getTierCapabilities,
  TIER_CAPABILITIES,
  type Tier,
} from './tier-capabilities'

describe('TIER_CAPABILITIES', () => {
  it('declares basesPerSpace for every tier per Features §4.1', () => {
    expect(TIER_CAPABILITIES.starter.basesPerSpace).toBe(5)
    expect(TIER_CAPABILITIES.launch.basesPerSpace).toBe(10)
    expect(TIER_CAPABILITIES.growth.basesPerSpace).toBe(15)
    expect(TIER_CAPABILITIES.pro.basesPerSpace).toBe(25)
    expect(TIER_CAPABILITIES.business.basesPerSpace).toBe(50)
    expect(TIER_CAPABILITIES.enterprise.basesPerSpace).toBeNull()
  })
})

describe('getTierCapabilities', () => {
  it('returns the matching tier set', () => {
    const caps = getTierCapabilities('pro')
    expect(caps.basesPerSpace).toBe(25)
  })

  it('returns starter capabilities when tier is null', () => {
    const caps = getTierCapabilities(null)
    expect(caps.basesPerSpace).toBe(5)
  })

  it('every Tier value resolves', () => {
    const tiers: Tier[] = ['starter', 'launch', 'growth', 'pro', 'business', 'enterprise']
    for (const t of tiers) {
      expect(getTierCapabilities(t)).toBeDefined()
    }
  })
})
