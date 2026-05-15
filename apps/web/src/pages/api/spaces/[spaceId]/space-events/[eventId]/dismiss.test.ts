/**
 * Tests for the testable inner handler (handlePost) in dismiss.ts.
 * The Astro APIRoute wrapper wires real Drizzle at runtime; the inner
 * handler takes all deps as arguments so vitest can run them with vi.fn().
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost } = await import('./dismiss')

import type { AccountContext } from '../../../../../../lib/account'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'
const EVENT_ID = '33333333-3333-3333-3333-333333333333'

function makeAccount(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    user: {
      id: 'u_1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      image: null,
    },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Acme', status: 'active' }],
    ...overrides,
  } as AccountContext
}

describe('handlePost', () => {
  it('returns 401 without an account', async () => {
    const res = await handlePost({
      account: null,
      spaceId: SPACE_ID,
      eventId: EVENT_ID,
      fetchSpaceById: vi.fn(),
      dismissEvent: vi.fn(),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 on non-UUID spaceId', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: 'bad',
      eventId: EVENT_ID,
      fetchSpaceById: vi.fn(),
      dismissEvent: vi.fn(),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 on non-UUID eventId', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      eventId: 'bad',
      fetchSpaceById: vi.fn(),
      dismissEvent: vi.fn(),
    })
    expect(res.status).toBe(400)
  })

  it('returns 403 when Space belongs to another org (IDOR)', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      eventId: EVENT_ID,
      fetchSpaceById: vi.fn(async () => ({
        id: SPACE_ID,
        organizationId: 'other-org',
      })),
      dismissEvent: vi.fn(),
    })
    expect(res.status).toBe(403)
  })

  it('returns 200 and calls dismissEvent with (spaceId, eventId) on success', async () => {
    const dismissEvent = vi.fn(async () => 1)
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      eventId: EVENT_ID,
      fetchSpaceById: vi.fn(async () => ({
        id: SPACE_ID,
        organizationId: ORG_ID,
      })),
      dismissEvent,
    })
    expect(res.status).toBe(200)
    expect(dismissEvent).toHaveBeenCalledWith(SPACE_ID, EVENT_ID)
  })

  it('returns 404 when the event row was not found (already dismissed or wrong space)', async () => {
    const dismissEvent = vi.fn(async () => 0)
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      eventId: EVENT_ID,
      fetchSpaceById: vi.fn(async () => ({
        id: SPACE_ID,
        organizationId: ORG_ID,
      })),
      dismissEvent,
    })
    expect(res.status).toBe(404)
  })
})
