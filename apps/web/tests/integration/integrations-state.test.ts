import { beforeEach, describe, expect, it } from 'vitest'
import { storageDestinations } from '../../src/db/schema'
import { getIntegrationsState } from '../../src/lib/integrations'
import {
  db,
  resetBaseoutTables,
  seedOrgWithMembership,
  seedUser,
} from './setup/testHarness'

describe('getIntegrationsState — storage destination (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
  })

  it('surfaces a connected Box destination (type + account email)', async () => {
    const { userId } = await seedUser()
    const { organizationId, spaceId } = await seedOrgWithMembership(userId)

    await db.insert(storageDestinations).values({
      spaceId,
      type: 'box',
      oauthAccessTokenEnc: 'enc-access',
      oauthRefreshTokenEnc: 'enc-refresh',
      oauthAccountEmail: 'autumn@example.invalid',
      providerFolderId: 'folder-123',
      connectedByUserId: userId,
    })

    const state = await getIntegrationsState(db, organizationId, spaceId)

    expect(state.storageDestination).not.toBeNull()
    expect(state.storageDestination?.type).toBe('box')
    expect(state.storageDestination?.accountEmail).toBe('autumn@example.invalid')
    expect(typeof state.storageDestination?.connectedAt).toBe('string')
  })

  it('returns null storageDestination when no row exists for the Space', async () => {
    const { userId } = await seedUser()
    const { organizationId, spaceId } = await seedOrgWithMembership(userId)

    const state = await getIntegrationsState(db, organizationId, spaceId)

    expect(state.storageDestination).toBeNull()
  })

  it('never leaks token ciphertext into the client-safe summary', async () => {
    const { userId } = await seedUser()
    const { organizationId, spaceId } = await seedOrgWithMembership(userId)

    await db.insert(storageDestinations).values({
      spaceId,
      type: 'box',
      oauthAccessTokenEnc: 'enc-access-SECRET',
      oauthRefreshTokenEnc: 'enc-refresh-SECRET',
      oauthAccountEmail: 'autumn@example.invalid',
      connectedByUserId: userId,
    })

    const state = await getIntegrationsState(db, organizationId, spaceId)

    const serialized = JSON.stringify(state.storageDestination)
    expect(serialized).not.toContain('SECRET')
    expect(serialized).not.toContain('enc-access')
    expect(serialized).not.toContain('enc-refresh')
  })
})
