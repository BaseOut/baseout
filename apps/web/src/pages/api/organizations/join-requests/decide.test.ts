/**
 * Tests for the admin approve/decline handler ([requestId].ts) and the
 * pending-list handler (index.ts) — web-signup-domain-association task 2.3.
 */

import { describe, expect, it, vi } from 'vitest'
import type { AccountContext } from '../../../../lib/account'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost } = await import('./[requestId]')
const { handleGet } = await import('./index')

const REQUEST_ID = '33333333-3333-3333-3333-333333333333'
const ACTOR = { id: 'admin_1', email: 'admin@acme.com' }

function makeAccount(role: string): AccountContext {
  return {
    user: { id: ACTOR.id, name: 'Admin', email: ACTOR.email, image: null },
    organization: { id: 'org_1', name: 'Acme', slug: 'acme' },
    membership: { role, isDefault: true },
    space: null,
    spaces: [],
  }
}

describe('handlePost — approve/decline', () => {
  it('401 unauthenticated', async () => {
    const res = await handlePost({
      user: null,
      requestId: REQUEST_ID,
      body: { action: 'approve' },
      decide: vi.fn(),
      notifyRequester: vi.fn(),
    })
    expect(res.status).toBe(401)
  })

  it('400 on bad request id / action', async () => {
    expect(
      (
        await handlePost({
          user: ACTOR,
          requestId: 'nope',
          body: { action: 'approve' },
          decide: vi.fn(),
          notifyRequester: vi.fn(),
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await handlePost({
          user: ACTOR,
          requestId: REQUEST_ID,
          body: { action: 'yeet' },
          decide: vi.fn(),
          notifyRequester: vi.fn(),
        })
      ).status,
    ).toBe(400)
  })

  it('approve → 200 + requester notified', async () => {
    const notifyRequester = vi.fn().mockResolvedValue(undefined)
    const res = await handlePost({
      user: ACTOR,
      requestId: REQUEST_ID,
      body: { action: 'approve' },
      decide: vi.fn().mockResolvedValue({
        ok: true,
        status: 'approved',
        requester: { id: 'u_1', email: 'person@acme.com' },
        organization: { id: 'org_1', name: 'Acme' },
      }),
      notifyRequester,
    })
    expect(res.status).toBe(200)
    expect(notifyRequester).toHaveBeenCalledWith({
      requesterEmail: 'person@acme.com',
      organizationName: 'Acme',
    })
  })

  it('decline → 200, no requester notification', async () => {
    const notifyRequester = vi.fn()
    const res = await handlePost({
      user: ACTOR,
      requestId: REQUEST_ID,
      body: { action: 'decline' },
      decide: vi.fn().mockResolvedValue({
        ok: true,
        status: 'declined',
        requester: { id: 'u_1', email: 'person@acme.com' },
        organization: { id: 'org_1', name: 'Acme' },
      }),
      notifyRequester,
    })
    expect(res.status).toBe(200)
    expect(notifyRequester).not.toHaveBeenCalled()
  })

  it('maps decision rejections to statuses', async () => {
    const cases: Array<[string, number]> = [
      ['not_found', 404],
      ['not_admin', 403],
      ['not_pending', 409],
      ['expired', 410],
    ]
    for (const [reason, status] of cases) {
      const res = await handlePost({
        user: ACTOR,
        requestId: REQUEST_ID,
        body: { action: 'approve' },
        decide: vi.fn().mockResolvedValue({ ok: false, reason }),
        notifyRequester: vi.fn(),
      })
      expect(res.status).toBe(status)
    }
  })
})

describe('handlePost — seat cap enforcement (shared-entitlements 4.3)', () => {
  const blocked = {
    allowed: false as const,
    featureSlug: 'seats',
    used: 5,
    limit: 5,
    addonSlug: 'seats_2',
  }
  const allowed = {
    allowed: true as const,
    featureSlug: 'seats',
    used: 2,
    limit: 5,
    addonSlug: 'seats_2',
  }

  it('approve blocked at the seat cap → 403 limit_reached, decide never runs', async () => {
    const decide = vi.fn()
    const res = await handlePost({
      user: ACTOR,
      requestId: REQUEST_ID,
      body: { action: 'approve' },
      decide,
      notifyRequester: vi.fn(),
      checkSeatCap: vi.fn().mockResolvedValue(blocked),
    })
    expect(res.status).toBe(403)
    const payload = (await res.json()) as Record<string, unknown>
    expect(payload).toMatchObject({ code: 'limit_reached', feature: 'seats', addon: 'seats_2' })
    expect(decide).not.toHaveBeenCalled()
  })

  it('approve under the seat cap → proceeds to decide', async () => {
    const decide = vi.fn().mockResolvedValue({
      ok: true,
      status: 'approved',
      requester: { id: 'u_1', email: 'person@acme.com' },
      organization: { id: 'org_1', name: 'Acme' },
    })
    const res = await handlePost({
      user: ACTOR,
      requestId: REQUEST_ID,
      body: { action: 'approve' },
      decide,
      notifyRequester: vi.fn().mockResolvedValue(undefined),
      checkSeatCap: vi.fn().mockResolvedValue(allowed),
    })
    expect(res.status).toBe(200)
    expect(decide).toHaveBeenCalled()
  })

  it('decline never consults the seat cap', async () => {
    const checkSeatCap = vi.fn()
    await handlePost({
      user: ACTOR,
      requestId: REQUEST_ID,
      body: { action: 'decline' },
      decide: vi.fn().mockResolvedValue({
        ok: true,
        status: 'declined',
        requester: { id: 'u_1', email: 'x@acme.com' },
        organization: { id: 'org_1', name: 'Acme' },
      }),
      notifyRequester: vi.fn(),
      checkSeatCap,
    })
    expect(checkSeatCap).not.toHaveBeenCalled()
  })
})

describe('handleGet — pending list', () => {
  it('401 without an active org', async () => {
    const res = await handleGet({
      account: null,
      expireStale: vi.fn(),
      listPending: vi.fn(),
    })
    expect(res.status).toBe(401)
  })

  it('403 for plain members', async () => {
    const res = await handleGet({
      account: makeAccount('member'),
      expireStale: vi.fn(),
      listPending: vi.fn(),
    })
    expect(res.status).toBe(403)
  })

  it('expires stale rows then lists for owners', async () => {
    const expireStale = vi.fn().mockResolvedValue(1)
    const listPending = vi.fn().mockResolvedValue([])
    const res = await handleGet({
      account: makeAccount('owner'),
      expireStale,
      listPending,
    })
    expect(res.status).toBe(200)
    expect(expireStale).toHaveBeenCalledWith('org_1')
    expect(listPending).toHaveBeenCalledWith('org_1')
  })
})
