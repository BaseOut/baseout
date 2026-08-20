/**
 * Tests for handleDataMedia — Data ▸ Attachments proxy (Slice A Task 3).
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleDataMedia } = await import('./media')

import type { AccountContext } from '../../../../../lib/account'
import type { GetMediaResult } from '../../../../../lib/backup-engine'

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
const manual = vi.fn(async () => 'manual' as const)

const base = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  query: {},
  fetchSpace: inOrg,
  resolveLevel: manual,
}

describe('handleDataMedia', () => {
  it('401 when unauthenticated', async () => {
    const res = await handleDataMedia({ ...base, account: null, engine: vi.fn() })
    expect(res.status).toBe(401)
  })

  it('503 when engine is unconfigured', async () => {
    const res = await handleDataMedia({ ...base, engine: null })
    expect(res.status).toBe(503)
  })

  it('200 passthrough of media items', async () => {
    const page: GetMediaResult = { ok: true, items: [], nextCursor: null }
    const engine = vi.fn(async () => page)
    const res = await handleDataMedia({ ...base, engine })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, items: [], nextCursor: null })
  })
})
