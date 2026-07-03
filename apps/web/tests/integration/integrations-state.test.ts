import { beforeEach, describe, expect, it } from 'vitest'
import { storageDestinations } from '../../src/db/schema'
import { getIntegrationsState } from '../../src/lib/integrations'
import {
  db,
  resetBaseoutTables,
  seedOrgWithMembership,
  seedUser,
} from './setup/testHarness'

describe('getIntegrationsState — storage destinations (integration)', () => {
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

    expect(state.storageDestinations).toHaveLength(1)
    expect(state.storageDestinations[0]?.type).toBe('box')
    expect(state.storageDestinations[0]?.accountEmail).toBe('autumn@example.invalid')
    expect(typeof state.storageDestinations[0]?.connectedAt).toBe('string')
  })

  it('keeps one row per provider type, most recently connected first', async () => {
    const { userId } = await seedUser()
    const { organizationId, spaceId } = await seedOrgWithMembership(userId)

    await db.insert(storageDestinations).values([
      {
        spaceId,
        type: 'google_drive',
        oauthAccessTokenEnc: 'enc-access-drive',
        oauthRefreshTokenEnc: 'enc-refresh-drive',
        oauthAccountEmail: 'drive@example.invalid',
        connectedByUserId: userId,
        connectedAt: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        spaceId,
        type: 'box',
        oauthAccessTokenEnc: 'enc-access-box',
        oauthRefreshTokenEnc: 'enc-refresh-box',
        oauthAccountEmail: 'box@example.invalid',
        connectedByUserId: userId,
        connectedAt: new Date('2026-06-15T00:00:00.000Z'),
      },
    ])

    const state = await getIntegrationsState(db, organizationId, spaceId)

    expect(state.storageDestinations.map((d) => d.type)).toEqual([
      'box',
      'google_drive',
    ])
  })

  it('returns no storage destinations when no row exists for the Space', async () => {
    const { userId } = await seedUser()
    const { organizationId, spaceId } = await seedOrgWithMembership(userId)

    const state = await getIntegrationsState(db, organizationId, spaceId)

    expect(state.storageDestinations).toEqual([])
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

    const serialized = JSON.stringify(state.storageDestinations)
    expect(serialized).not.toContain('SECRET')
    expect(serialized).not.toContain('enc-access')
    expect(serialized).not.toContain('enc-refresh')
  })
})
