import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  CAPABILITY_CACHE_TTL_MS,
  getCachedCapabilities,
  setCachedCapabilities,
  invalidateCapabilityCache,
  __resetCapabilityCacheForTests,
} from './cache'
import type { ResolvedCapabilities } from './resolve'

const PRO: ResolvedCapabilities = {
  tier: 'pro',
  hasSubscription: true,
  capabilities: { basesPerSpace: 25 },
}

const BUSINESS: ResolvedCapabilities = {
  tier: 'business',
  hasSubscription: true,
  capabilities: { basesPerSpace: 50 },
}

describe('capability cache', () => {
  beforeEach(() => {
    __resetCapabilityCacheForTests()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null on a cold key', () => {
    expect(getCachedCapabilities('org_1', 'airtable')).toBeNull()
  })

  it('returns the cached value within the TTL', () => {
    setCachedCapabilities('org_1', 'airtable', PRO)
    vi.advanceTimersByTime(CAPABILITY_CACHE_TTL_MS - 1)
    expect(getCachedCapabilities('org_1', 'airtable')).toEqual(PRO)
  })

  it('expires at exactly the TTL boundary', () => {
    setCachedCapabilities('org_1', 'airtable', PRO)
    vi.advanceTimersByTime(CAPABILITY_CACHE_TTL_MS)
    expect(getCachedCapabilities('org_1', 'airtable')).toBeNull()
  })

  it('isolates entries by platform slug', () => {
    setCachedCapabilities('org_1', 'airtable', PRO)
    setCachedCapabilities('org_1', 'notion', BUSINESS)
    expect(getCachedCapabilities('org_1', 'airtable')).toEqual(PRO)
    expect(getCachedCapabilities('org_1', 'notion')).toEqual(BUSINESS)
  })

  it('isolates entries by organization', () => {
    setCachedCapabilities('org_1', 'airtable', PRO)
    setCachedCapabilities('org_2', 'airtable', BUSINESS)
    expect(getCachedCapabilities('org_1', 'airtable')).toEqual(PRO)
    expect(getCachedCapabilities('org_2', 'airtable')).toEqual(BUSINESS)
  })

  describe('invalidateCapabilityCache', () => {
    it('drops a single (org, platform) entry when both args are passed', () => {
      setCachedCapabilities('org_1', 'airtable', PRO)
      setCachedCapabilities('org_1', 'notion', BUSINESS)
      invalidateCapabilityCache('org_1', 'airtable')
      expect(getCachedCapabilities('org_1', 'airtable')).toBeNull()
      expect(getCachedCapabilities('org_1', 'notion')).toEqual(BUSINESS)
    })

    it('drops every entry for an org when platform is omitted', () => {
      setCachedCapabilities('org_1', 'airtable', PRO)
      setCachedCapabilities('org_1', 'notion', BUSINESS)
      setCachedCapabilities('org_2', 'airtable', PRO)
      invalidateCapabilityCache('org_1')
      expect(getCachedCapabilities('org_1', 'airtable')).toBeNull()
      expect(getCachedCapabilities('org_1', 'notion')).toBeNull()
      expect(getCachedCapabilities('org_2', 'airtable')).toEqual(PRO)
    })

    it('is a no-op for unknown keys', () => {
      expect(() =>
        invalidateCapabilityCache('org_unknown', 'airtable'),
      ).not.toThrow()
      expect(() => invalidateCapabilityCache('org_unknown')).not.toThrow()
    })
  })
})
