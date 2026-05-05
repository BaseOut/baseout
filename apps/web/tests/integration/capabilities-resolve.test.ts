import { beforeEach, describe, expect, it } from 'vitest'
import { resolveCapabilities } from '../../src/lib/capabilities/resolve'
import {
  db,
  resetBaseoutTables,
  seedAirtablePlatform,
  seedOrgWithMembership,
  seedSubscriptionItem,
  seedUser,
} from './setup/testHarness'

describe('resolveCapabilities (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
  })

  it('returns the cached tier from subscription_items', async () => {
    const { userId } = await seedUser()
    const { organizationId } = await seedOrgWithMembership(userId)
    const { platformId } = await seedAirtablePlatform()
    await seedSubscriptionItem(organizationId, { tier: 'pro', platformId })

    const result = await resolveCapabilities(db, organizationId, 'airtable')

    expect(result.tier).toBe('pro')
    expect(result.hasSubscription).toBe(true)
    expect(result.capabilities.basesPerSpace).toBe(25)
  })

  it('falls back to starter when no subscription item exists', async () => {
    const { userId } = await seedUser()
    const { organizationId } = await seedOrgWithMembership(userId)
    await seedAirtablePlatform()

    const result = await resolveCapabilities(db, organizationId, 'airtable')

    expect(result.tier).toBeNull()
    expect(result.hasSubscription).toBe(false)
    expect(result.capabilities.basesPerSpace).toBe(5)
  })

  it('returns null tier when the platform slug is unknown', async () => {
    const { userId } = await seedUser()
    const { organizationId } = await seedOrgWithMembership(userId)

    const result = await resolveCapabilities(db, organizationId, 'airtable')

    expect(result.tier).toBeNull()
    expect(result.hasSubscription).toBe(false)
  })

  it('treats a cancelled subscription as no subscription', async () => {
    const { userId } = await seedUser()
    const { organizationId } = await seedOrgWithMembership(userId)
    const { platformId } = await seedAirtablePlatform()
    await seedSubscriptionItem(organizationId, {
      tier: 'business',
      platformId,
      status: 'cancelled',
    })

    const result = await resolveCapabilities(db, organizationId, 'airtable')

    expect(result.tier).toBeNull()
    expect(result.hasSubscription).toBe(false)
    expect(result.capabilities.basesPerSpace).toBe(5)
  })
})
