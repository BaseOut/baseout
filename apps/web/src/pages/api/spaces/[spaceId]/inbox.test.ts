/**
 * Tests for handleInboxFeed (web-notifications-inbox §5.1 read proxy): auth,
 * IDOR, 503 unconfigured, result passthrough, and engine error mapping.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleInboxFeed } = await import('./inbox')

import type { AccountContext } from '../../../../lib/account'
import type { GetNotificationsResult, InboxItemView } from '../../../../lib/backup-engine'

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
  fetchSpace: inOrg,
}

describe('handleInboxFeed', () => {
  it('401 when unauthenticated', async () => {
    const res = await handleInboxFeed({ ...baseInput, account: null, engine: vi.fn() })
    expect(res.status).toBe(401)
  })

  it('400 on a non-UUID spaceId', async () => {
    const engine = vi.fn()
    const res = await handleInboxFeed({ ...baseInput, spaceId: 'not-a-uuid', engine })
    expect(res.status).toBe(400)
    expect(engine).not.toHaveBeenCalled()
  })

  it('403 when the Space belongs to another org (IDOR)', async () => {
    const res = await handleInboxFeed({
      ...baseInput,
      fetchSpace: vi.fn(async () => ({ id: SPACE_ID, organizationId: 'other-org' })),
      engine: vi.fn(),
    })
    expect(res.status).toBe(403)
  })

  it('403 when the Space does not exist', async () => {
    const res = await handleInboxFeed({
      ...baseInput,
      fetchSpace: vi.fn(async () => null),
      engine: vi.fn(),
    })
    expect(res.status).toBe(403)
  })

  it('503 when the engine binding is unconfigured', async () => {
    const res = await handleInboxFeed({ ...baseInput, engine: null })
    expect(res.status).toBe(503)
  })

  it('returns the engine items', async () => {
    const items: InboxItemView[] = [
      {
        id: 'run:r1',
        kind: 'backup-failed',
        title: '*Sales CRM* backup failed',
        at: '2026-07-09T10:00:00.000Z',
      },
    ]
    const engine = vi.fn(async (): Promise<GetNotificationsResult> => ({ ok: true, items }))
    const res = await handleInboxFeed({ ...baseInput, engine })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, items })
    expect(engine).toHaveBeenCalledWith(SPACE_ID)
  })

  it('maps an engine failure through inboxProxyStatus', async () => {
    const engine = vi.fn(
      async (): Promise<GetNotificationsResult> => ({
        ok: false,
        code: 'engine_unreachable',
        status: 0,
      }),
    )
    const res = await handleInboxFeed({ ...baseInput, engine })
    expect(res.status).toBe(502)
    expect(((await res.json()) as { error: string }).error).toBe('engine_unreachable')
  })
})
