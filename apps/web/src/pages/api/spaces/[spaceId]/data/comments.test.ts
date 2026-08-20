/**
 * Tests for handleDataComments — Data ▸ Comments proxy (Slice A Task 7–8).
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleDataComments } = await import('./comments')

import type { AccountContext } from '../../../../../lib/account'
import type { GetDataCommentsResult } from '../../../../../lib/backup-engine'

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

describe('handleDataComments', () => {
  it('401 when unauthenticated', async () => {
    const res = await handleDataComments({ ...base, account: null, engine: vi.fn() })
    expect(res.status).toBe(401)
  })

  it('503 when engine is unconfigured', async () => {
    const res = await handleDataComments({ ...base, engine: null })
    expect(res.status).toBe(503)
  })

  it('200 passthrough of the comments page', async () => {
    const page: GetDataCommentsResult = {
      ok: true,
      comments: [
        {
          commentId: 'com1',
          recordId: 'rec1',
          tableId: 'tbl1',
          baseId: 'app1',
          author: { id: 'usr1' },
          text: 'hi',
          createdTime: '2026-08-01T10:00:00.000Z',
          lastUpdatedTime: null,
          lastSeenAt: '2026-08-05T00:00:00.000Z',
          status: 'active',
          parentCommentId: null,
          mentioned: null,
        },
      ],
      nextCursor: null,
      total: 1,
      approximate: false,
    }
    const engine = vi.fn(async () => page)
    const res = await handleDataComments({ ...base, engine })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      comments: page.comments,
      nextCursor: null,
      total: 1,
      approximate: false,
    })
    expect(engine).toHaveBeenCalledWith(SPACE_ID, {})
  })

  it('501 when engine reports backend_not_implemented', async () => {
    const engine = vi.fn(async (): Promise<GetDataCommentsResult> => ({
      ok: false,
      code: 'backend_not_implemented',
      status: 501,
    }))
    const res = await handleDataComments({ ...base, engine })
    expect(res.status).toBe(501)
    expect(((await res.json()) as { error: string }).error).toBe('backend_not_implemented')
  })
})
