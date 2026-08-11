/**
 * Tests for handleChatThreads (web-chat-tab). Pins the route glue incl. the Pro+
 * (manual_ai) gate: a Launch-only (`manual`) org is 403.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleChatThreads } = await import('./threads')

import type { AccountContext } from '../../../../../lib/account'
import type { ListChatThreadsResult, CreateChatThreadResult } from '../../../../../lib/backup-engine'

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
const proAi = vi.fn(async () => 'manual_ai' as const)
const manualOnly = vi.fn(async () => 'manual' as const)

const engine = {
  listChatThreads: vi.fn(async (): Promise<ListChatThreadsResult> => ({ ok: true, threads: [] })),
  createChatThread: vi.fn(async (): Promise<CreateChatThreadResult> => ({ ok: true, id: 't_new' })),
}

const base = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  method: 'GET' as const,
  includeArchived: false,
  userId: 'u_1',
  fetchSpace: inOrg,
  resolveLevel: proAi,
  engine,
}

describe('handleChatThreads', () => {
  it('401 when unauthenticated', async () => {
    const res = await handleChatThreads({ ...base, account: null })
    expect(res.status).toBe(401)
  })

  it('403 when the org is Launch-only (not Pro+/manual_ai)', async () => {
    const res = await handleChatThreads({ ...base, resolveLevel: manualOnly })
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: string }).error).toBe('chat_not_entitled')
  })

  it('503 when the engine is unconfigured', async () => {
    const res = await handleChatThreads({ ...base, engine: null })
    expect(res.status).toBe(503)
  })

  it('GET lists threads', async () => {
    const res = await handleChatThreads(base)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, threads: [] })
    expect(engine.listChatThreads).toHaveBeenCalledWith(SPACE_ID, false)
  })

  it('POST creates a thread (201) with the user id', async () => {
    const res = await handleChatThreads({ ...base, method: 'POST' })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true, id: 't_new' })
    expect(engine.createChatThread).toHaveBeenCalledWith(SPACE_ID, 'u_1')
  })
})
