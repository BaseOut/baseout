import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { POST } from '../../src/pages/api/spaces/[spaceId]/backup-config/bases'
import {
  backupConfigurationBases,
  backupConfigurations,
} from '../../src/db/schema'
import {
  db,
  resetBaseoutTables,
  seedAirtablePlatform,
  seedAtBase,
  seedOrgWithMembership,
  seedSubscriptionItem,
  seedUser,
} from './setup/testHarness'

interface CallOpts {
  spaceId: string
  account: unknown
  body: unknown
}

async function callPost(opts: CallOpts): Promise<Response> {
  const request = new Request(
    `http://localhost/api/spaces/${opts.spaceId}/backup-config/bases`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts.body),
    },
  )
  return Promise.resolve(
    POST({
      request,
      params: { spaceId: opts.spaceId },
      locals: { account: opts.account, db },
    } as never),
  ) as Promise<Response>
}

describe('POST /api/spaces/[spaceId]/backup-config/bases (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
  })

  it('returns 401 when account is null', async () => {
    const res = await callPost({ spaceId: 'sp_x', account: null, body: { atBaseIds: [] } })
    expect(res.status).toBe(401)
  })

  it('returns 403 when the spaceId does not belong to the active org', async () => {
    const { userId } = await seedUser()
    const { organizationId } = await seedOrgWithMembership(userId)

    const res = await callPost({
      spaceId: 'sp_does_not_exist',
      account: { user: { id: userId }, organization: { id: organizationId } },
      body: { atBaseIds: [] },
    })
    expect(res.status).toBe(403)
  })

  it('rejects with 422 when selection exceeds the tier cap', async () => {
    const { userId } = await seedUser()
    const { organizationId, spaceId } = await seedOrgWithMembership(userId)
    const { platformId } = await seedAirtablePlatform()
    await seedSubscriptionItem(organizationId, { tier: 'starter', platformId })
    // Starter cap is 5 — seed 6 bases and request all 6.
    const baseIds: string[] = []
    for (let i = 0; i < 6; i++) {
      const { atBaseRowId } = await seedAtBase(spaceId, { atBaseId: `app${i}`, name: `B${i}` })
      baseIds.push(atBaseRowId)
    }

    const res = await callPost({
      spaceId,
      account: { user: { id: userId }, organization: { id: organizationId } },
      body: { atBaseIds: baseIds },
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string; limit: number; requested: number }
    expect(body.error).toBe('over_tier_limit')
    expect(body.limit).toBe(5)
    expect(body.requested).toBe(6)
  })

  it('persists the selection and reports the resulting count', async () => {
    const { userId } = await seedUser()
    const { organizationId, spaceId } = await seedOrgWithMembership(userId)
    const { platformId } = await seedAirtablePlatform()
    await seedSubscriptionItem(organizationId, { tier: 'pro', platformId })
    const { atBaseRowId: a } = await seedAtBase(spaceId, { atBaseId: 'appA', name: 'A' })
    const { atBaseRowId: b } = await seedAtBase(spaceId, { atBaseId: 'appB', name: 'B' })

    const res = await callPost({
      spaceId,
      account: { user: { id: userId }, organization: { id: organizationId } },
      body: { atBaseIds: [a, b] },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: true; included: number; basesPerSpace: number | null }
    expect(body).toEqual({ ok: true, included: 2, basesPerSpace: 25 })

    const [config] = await db
      .select()
      .from(backupConfigurations)
      .where(eq(backupConfigurations.spaceId, spaceId))
    expect(config).toBeTruthy()

    const baseRows = await db
      .select({ atBaseId: backupConfigurationBases.atBaseId, isIncluded: backupConfigurationBases.isIncluded })
      .from(backupConfigurationBases)
      .where(eq(backupConfigurationBases.backupConfigurationId, config.id))
    expect(baseRows.filter((r) => r.isIncluded)).toHaveLength(2)
  })
})
