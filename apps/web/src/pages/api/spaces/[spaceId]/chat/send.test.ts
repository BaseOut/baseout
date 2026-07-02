/**
 * Tests for handleChatSend (web-chat-tab) incl. the Pro+ gate + body validation.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleChatSend } = await import('./send')

import type { AccountContext } from '../../../../../lib/account'
import type { SendChatMessageResult } from '../../../../../lib/backup-engine'

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

const base = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  parseBody: async () => ({ threadId: THREAD, message: 'What is in the CRM base?' }) as Record<string, unknown>,
  fetchSpace: inOrg,
  resolveLevel: proAi,
  engine: vi.fn(
    async (): Promise<SendChatMessageResult> => ({ ok: true, userMessageId: 'u1', assistantMessageId: 'a1' }),
  ),
}

describe('handleChatSend', () => {
  it('403 when not Pro+', async () => {
    const res = await handleChatSend({ ...base, resolveLevel: manualOnly })
    expect(res.status).toBe(403)
  })

  it('503 when the engine is unconfigured', async () => {
    const res = await handleChatSend({ ...base, engine: null })
    expect(res.status).toBe(503)
  })

  it('400 when message is empty', async () => {
    const engine = vi.fn()
    const res = await handleChatSend({
      ...base,
      parseBody: async () => ({ threadId: THREAD, message: '   ' }),
      engine,
    })
    expect(res.status).toBe(400)
    expect(engine).not.toHaveBeenCalled()
  })

  it('sends and returns the message ids', async () => {
    const res = await handleChatSend(base)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, userMessageId: 'u1', assistantMessageId: 'a1' })
    expect(base.engine).toHaveBeenCalledWith(SPACE_ID, THREAD, 'What is in the CRM base?')
  })
})
