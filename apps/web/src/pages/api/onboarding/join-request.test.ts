/**
 * Tests for the testable inner handler (handlePost) in join-request.ts
 * (web-signup-domain-association task 2.3). Mirrors the rescan-bases
 * route-test pattern: `cloudflare:workers` mocked, deps injected.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost } = await import('./join-request')

const ORG_ID = '22222222-2222-2222-2222-222222222222'
const USER = { id: 'u_1', email: 'person@acme.com' }

const okResult = {
  ok: true as const,
  requestId: 'jr_1',
  expiresAt: new Date('2026-08-03T12:00:00Z'),
  organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
  adminEmails: ['admin@acme.com'],
}

describe('handlePost — join-request create', () => {
  it('401 when unauthenticated', async () => {
    const res = await handlePost({
      user: null,
      body: { organizationId: ORG_ID },
      create: vi.fn(),
      notifyAdmins: vi.fn(),
    })
    expect(res.status).toBe(401)
  })

  it('400 on malformed organizationId', async () => {
    const res = await handlePost({
      user: USER,
      body: { organizationId: 'nope' },
      create: vi.fn(),
      notifyAdmins: vi.fn(),
    })
    expect(res.status).toBe(400)
  })

  it('201 + notifies admins on success', async () => {
    const notifyAdmins = vi.fn().mockResolvedValue(undefined)
    const res = await handlePost({
      user: USER,
      body: { organizationId: ORG_ID },
      create: vi.fn().mockResolvedValue(okResult),
      notifyAdmins,
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.requestId).toBe('jr_1')
    expect(notifyAdmins).toHaveBeenCalledWith({
      adminEmails: ['admin@acme.com'],
      organizationName: 'Acme',
      requesterEmail: USER.email,
    })
  })

  it('notification failure does not fail the request', async () => {
    const res = await handlePost({
      user: USER,
      body: { organizationId: ORG_ID },
      create: vi.fn().mockResolvedValue(okResult),
      notifyAdmins: vi.fn().mockRejectedValue(new Error('smtp down')),
    })
    expect(res.status).toBe(201)
  })

  it('maps lifecycle rejections to statuses', async () => {
    const cases: Array<[Record<string, unknown>, number]> = [
      [{ ok: false, reason: 'domain_mismatch' }, 403],
      [{ ok: false, reason: 'already_member' }, 409],
      [{ ok: false, reason: 'pending_exists' }, 409],
      [{ ok: false, reason: 'cooldown', until: new Date() }, 429],
    ]
    for (const [result, status] of cases) {
      const res = await handlePost({
        user: USER,
        body: { organizationId: ORG_ID },
        create: vi.fn().mockResolvedValue(result),
        notifyAdmins: vi.fn(),
      })
      expect(res.status).toBe(status)
    }
  })
})
