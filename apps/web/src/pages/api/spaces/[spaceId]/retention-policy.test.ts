/**
 * Tests for the inner handlePatch — PATCH /api/spaces/:id/retention-policy
 * (server-retention-and-cleanup Phase E.2). Mirrors backup-config.test.ts:
 * import the inner handler, pass vi.fn() deps, never touch real Drizzle.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePatch } = await import('./retention-policy')

import type { AccountContext } from '../../../../lib/account'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'

function makeAccount(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@example.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Acme', status: 'active' }],
    ...overrides,
  } as AccountContext
}

function makeDeps(overrides: Partial<Parameters<typeof handlePatch>[0]> = {}) {
  return {
    fetchSpaceById: vi.fn(async () => ({ id: SPACE_ID, organizationId: ORG_ID })),
    resolveTier: vi.fn(async () => 'pro' as const),
    upsertPolicy: vi.fn(async () => {}),
    ...overrides,
  }
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

describe('handlePatch (retention-policy)', () => {
  it('returns 401 when account is null', async () => {
    const res = await handlePatch({
      account: null,
      spaceId: SPACE_ID,
      body: { dailyWindowDays: 30 },
      ...makeDeps(),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 when spaceId is not a UUID', async () => {
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: 'nope',
      body: { dailyWindowDays: 30 },
      ...makeDeps(),
    })
    expect(res.status).toBe(400)
  })

  it('returns 403 when the space is not found', async () => {
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { dailyWindowDays: 30 },
      ...makeDeps({ fetchSpaceById: vi.fn(async () => null) }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 403 (IDOR) when the space belongs to another org', async () => {
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { dailyWindowDays: 30 },
      ...makeDeps({
        fetchSpaceById: vi.fn(async () => ({
          id: SPACE_ID,
          organizationId: 'other-org',
        })),
      }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 knob_out_of_range with the offending field', async () => {
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { dailyWindowDays: 999 }, // pro daily max is 90
      ...makeDeps(),
    })
    expect(res.status).toBe(400)
    const body = await readJson(res)
    expect(body.error).toBe('knob_out_of_range')
    expect(body.field).toBe('dailyWindowDays')
  })

  it('returns 200 and UPSERTs the validated policy values', async () => {
    const upsertPolicy = vi.fn(async () => {})
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { dailyWindowDays: 30, weeklyWindowDays: 120 },
      ...makeDeps({ upsertPolicy }),
    })
    expect(res.status).toBe(200)
    expect(upsertPolicy).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      tier: 'three_tier',
      dailyWindowDays: 30,
      weeklyWindowDays: 120,
      monthlyIndefinite: true,
    })
    const body = await readJson(res)
    expect(body.ok).toBe(true)
  })

  it('returns 405 stubs for GET', async () => {
    const mod = await import('./retention-policy')
    // The GET stub ignores its context arg; pass a cast placeholder to satisfy
    // the APIRoute (context) => Response signature.
    const res = await mod.GET({} as Parameters<typeof mod.GET>[0])
    expect(res.status).toBe(405)
  })
})
