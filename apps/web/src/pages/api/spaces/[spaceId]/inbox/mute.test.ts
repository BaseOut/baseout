/**
 * Tests for handleInboxMute + parseMuteBody (web-notifications-inbox §5.1):
 * server-side validation, auth/IDOR reuse, and engine forwarding.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleInboxMute, parseMuteBody } = await import('./mute')

import type { AccountContext } from '../../../../../lib/account'
import type { MuteNotificationBaseResult } from '../../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'

function makeAccount(): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@example.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Acme', status: 'active' }],
  } as AccountContext
}

const inOrg = vi.fn(async () => ({ id: SPACE_ID, organizationId: ORG_ID }))

const baseInput = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  body: { baseId: 'appXYZ', muted: true },
  fetchSpace: inOrg,
}

describe('parseMuteBody', () => {
  it('accepts mute and unmute', () => {
    expect(parseMuteBody({ baseId: 'appXYZ', muted: true })).toEqual({ baseId: 'appXYZ', muted: true })
    expect(parseMuteBody({ baseId: 'appXYZ', muted: false })).toEqual({ baseId: 'appXYZ', muted: false })
  })

  it.each([
    ['null body', null],
    ['missing baseId', { muted: true }],
    ['empty baseId', { baseId: '', muted: true }],
    ['oversized baseId', { baseId: 'x'.repeat(129), muted: true }],
    ['missing muted', { baseId: 'appXYZ' }],
    ['stringly muted', { baseId: 'appXYZ', muted: 'true' }],
  ])('rejects %s', (_name, body) => {
    expect(parseMuteBody(body)).toBeNull()
  })
})

describe('handleInboxMute', () => {
  it('401 when unauthenticated', async () => {
    const res = await handleInboxMute({ ...baseInput, account: null, engine: vi.fn() })
    expect(res.status).toBe(401)
  })

  it('403 when the Space belongs to another org (IDOR)', async () => {
    const res = await handleInboxMute({
      ...baseInput,
      fetchSpace: vi.fn(async () => ({ id: SPACE_ID, organizationId: 'other-org' })),
      engine: vi.fn(),
    })
    expect(res.status).toBe(403)
  })

  it('400 on an invalid body — engine untouched', async () => {
    const engine = vi.fn()
    const res = await handleInboxMute({ ...baseInput, body: { muted: true }, engine })
    expect(res.status).toBe(400)
    expect(engine).not.toHaveBeenCalled()
  })

  it('503 when the engine binding is unconfigured', async () => {
    const res = await handleInboxMute({ ...baseInput, engine: null })
    expect(res.status).toBe(503)
  })

  it('forwards baseId + muted and returns ok', async () => {
    const engine = vi.fn(async (): Promise<MuteNotificationBaseResult> => ({ ok: true }))
    const res = await handleInboxMute({ ...baseInput, engine })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(engine).toHaveBeenCalledWith(SPACE_ID, 'appXYZ', true)
  })

  it('maps an engine failure through inboxProxyStatus', async () => {
    const engine = vi.fn(
      async (): Promise<MuteNotificationBaseResult> => ({
        ok: false,
        code: 'space_db_not_ready',
        status: 409,
      }),
    )
    const res = await handleInboxMute({ ...baseInput, engine })
    expect(res.status).toBe(409)
  })
})
