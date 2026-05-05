/**
 * Function-level integration tests for src/pages/api/me.ts.
 *
 * /api/me reads only `locals.account` — middleware is responsible for
 * populating it. This test exercises the handler against a real
 * AccountContext built from real Postgres fixtures.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { GET } from '../../src/pages/api/me'
import { getAccountContext } from '../../src/lib/account'
import {
  db,
  resetBaseoutTables,
  seedOrgWithMembership,
  seedUser,
} from './setup/testHarness'

function callGet(locals: Record<string, unknown>): Promise<Response> {
  // The handler only reads `locals`; cast satisfies APIContext shape.
  return Promise.resolve(GET({ locals } as never)) as Promise<Response>
}

describe('GET /api/me (integration)', () => {
  beforeEach(async () => {
    await resetBaseoutTables()
  })

  it('returns 401 JSON when locals.account is null', async () => {
    const res = await callGet({ account: null })
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Not authenticated')
  })

  it('returns 200 with the AccountContext shape for an onboarded user', async () => {
    const { userId, email, name } = await seedUser()
    const { organizationId, spaceId, slug } = await seedOrgWithMembership(userId)
    const account = await getAccountContext(db, userId)
    expect(account).toBeTruthy()

    const res = await callGet({ account })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    const body = (await res.json()) as Awaited<ReturnType<typeof getAccountContext>>
    expect(body).toMatchObject({
      user: { id: userId, email, name },
      organization: { id: organizationId, slug },
      membership: { role: 'owner', isDefault: true },
      space: { id: spaceId, name: 'Production' },
    })
    expect(body!.spaces).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: spaceId, name: 'Production' })]),
    )
  })

  it('does not leak fields beyond the documented AccountContext shape', async () => {
    const { userId } = await seedUser()
    await seedOrgWithMembership(userId)
    const account = await getAccountContext(db, userId)

    const res = await callGet({ account })
    const body = (await res.json()) as Record<string, unknown>
    const allowedKeys = new Set(['user', 'organization', 'membership', 'space', 'spaces'])
    for (const key of Object.keys(body)) {
      expect(allowedKeys.has(key)).toBe(true)
    }
    const userKeys = Object.keys(body.user as Record<string, unknown>)
    const allowedUserKeys = new Set(['id', 'name', 'email', 'image'])
    for (const key of userKeys) {
      expect(allowedUserKeys.has(key)).toBe(true)
    }
  })
})
