/**
 * Tests for the testable inner handler (handlePost) in alias.ts — the
 * workspace-rename endpoint the promoted base picker fires
 * (fire-and-forget) when a user names a placeholder "Workspace N" group.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost } = await import('./alias')

import type { AccountContext } from '../../../../lib/account'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'

function makeAccount(): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@example.com', image: null },
    organization: { id: 'org_1', name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Acme', status: 'active' }],
  } as AccountContext
}

const body = (v: unknown) =>
  new Request('http://test/api/workspaces/wspX/alias', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(v),
  })

describe('handlePost — workspace alias', () => {
  it('401 without an account/space', async () => {
    const res = await handlePost({
      account: null,
      wsId: 'wspX',
      request: body({ alias: 'Marketing' }),
      saveAlias: vi.fn(),
    })
    expect(res.status).toBe(401)
  })

  it('400 on a missing/empty alias or invalid JSON', async () => {
    const bad = await handlePost({
      account: makeAccount(),
      wsId: 'wspX',
      request: body({ alias: '   ' }),
      saveAlias: vi.fn(),
    })
    expect(bad.status).toBe(400)

    const invalid = await handlePost({
      account: makeAccount(),
      wsId: 'wspX',
      request: new Request('http://test', { method: 'POST', body: 'not json' }),
      saveAlias: vi.fn(),
    })
    expect(invalid.status).toBe(400)
  })

  it('saves a trimmed alias scoped to the active Space + workspace id', async () => {
    const saveAlias = vi.fn(async () => ({ updated: 1 }))
    const res = await handlePost({
      account: makeAccount(),
      wsId: 'wspMkt001',
      request: body({ alias: '  Marketing  ', kind: 'placeholder-fill' }),
      saveAlias,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(saveAlias).toHaveBeenCalledWith(SPACE_ID, 'wspMkt001', 'Marketing')
  })

  it('404 when the workspace is not enrolled in the active Space', async () => {
    const res = await handlePost({
      account: makeAccount(),
      wsId: 'wspNope',
      request: body({ alias: 'X' }),
      saveAlias: vi.fn(async () => ({ updated: 0 })),
    })
    expect(res.status).toBe(404)
  })

  it('caps alias length', async () => {
    const res = await handlePost({
      account: makeAccount(),
      wsId: 'wspX',
      request: body({ alias: 'x'.repeat(300) }),
      saveAlias: vi.fn(),
    })
    expect(res.status).toBe(400)
  })
})
