/**
 * Tests for handleChatThread (web-chat-tab) — GET thread + PATCH rename/archive/
 * context, with the Pro+ gate.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleChatThread } = await import('./[threadId]')

import type { AccountContext } from '../../../../../../lib/account'
import type { GetChatThreadResult, PatchChatThreadResult } from '../../../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'
const THREAD = '33333333-3333-3333-3333-333333333333'

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
  getChatThread: vi.fn(
    async (): Promise<GetChatThreadResult> => ({
      ok: true,
      thread: { id: THREAD, title: 'T', archived: false, scope: null, attachedDocIds: [], messages: [] },
    }),
  ),
  patchChatThread: vi.fn(async (): Promise<PatchChatThreadResult> => ({ ok: true })),
}

const base = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  threadId: THREAD,
  method: 'GET' as const,
  parseBody: async () => ({}) as Record<string, unknown>,
  fetchSpace: inOrg,
  resolveLevel: proAi,
  engine,
}

describe('handleChatThread', () => {
  it('403 when not Pro+', async () => {
    const res = await handleChatThread({ ...base, resolveLevel: manualOnly })
    expect(res.status).toBe(403)
  })

  it('GET returns the thread', async () => {
    const res = await handleChatThread(base)
    expect(res.status).toBe(200)
    expect(((await res.json()) as { thread: { id: string } }).thread.id).toBe(THREAD)
    expect(engine.getChatThread).toHaveBeenCalledWith(SPACE_ID, THREAD)
  })

  it('PATCH rename forwards to the engine', async () => {
    const res = await handleChatThread({
      ...base,
      method: 'PATCH',
      parseBody: async () => ({ title: 'Renamed' }),
    })
    expect(res.status).toBe(200)
    expect(engine.patchChatThread).toHaveBeenCalledWith(SPACE_ID, THREAD, { title: 'Renamed' })
  })

  it('PATCH 400 on an empty body', async () => {
    const res = await handleChatThread({ ...base, method: 'PATCH', parseBody: async () => ({}) })
    expect(res.status).toBe(400)
  })
})
