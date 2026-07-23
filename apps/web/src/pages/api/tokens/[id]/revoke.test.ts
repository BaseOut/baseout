/**
 * Tests for the testable inner handler (handlePost) in revoke.ts — API token
 * revocation (openspec/changes/web-api-tokens, design D1/D2/D4).
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost } = await import('./revoke')

import type { AccountContext } from '../../../../lib/account'
import type { HandlePostDeps } from './revoke'

const ORG_ID = '22222222-2222-2222-2222-222222222222'
const TOKEN_ID = '44444444-4444-4444-4444-444444444444'

function makeAccount(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@example.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: null,
    spaces: [],
    ...overrides,
  } as AccountContext
}

function makeDeps(overrides: Partial<HandlePostDeps> = {}): HandlePostDeps {
  return {
    fetchTokenForOrg: vi.fn(async () => ({ id: TOKEN_ID, isActive: true })),
    revokeToken: vi.fn(async () => {}),
    logEvent: vi.fn(),
    ...overrides,
  }
}

async function post(
  tokenId: string | undefined,
  account: AccountContext | null = makeAccount(),
  deps: HandlePostDeps = makeDeps(),
): Promise<Response> {
  return handlePost({ account, tokenId, deps })
}

describe('handlePost — revoke', () => {
  it('401 when not authenticated', async () => {
    expect((await post(TOKEN_ID, null)).status).toBe(401)
  })

  it('403 forbidden for member role', async () => {
    const res = await post(
      TOKEN_ID,
      makeAccount({ membership: { role: 'member', isDefault: true } } as never),
    )
    expect(res.status).toBe(403)
  })

  it('400 on a non-UUID id', async () => {
    expect((await post('not-a-uuid')).status).toBe(400)
    expect((await post(undefined)).status).toBe(400)
  })

  it("404 when the token doesn't exist or belongs to another Organization", async () => {
    const deps = makeDeps({ fetchTokenForOrg: vi.fn(async () => null) })
    const res = await post(TOKEN_ID, makeAccount(), deps)
    expect(res.status).toBe(404)
    // Org-scoped lookup is what prevents cross-tenant existence leaks.
    expect(deps.fetchTokenForOrg).toHaveBeenCalledWith(TOKEN_ID, ORG_ID)
  })

  it('200 revokes an active token and emits api_token.revoked', async () => {
    const deps = makeDeps()
    const res = await post(TOKEN_ID, makeAccount(), deps)
    expect(res.status).toBe(200)
    expect(deps.revokeToken).toHaveBeenCalledWith(TOKEN_ID)
    const [event, fields] = vi.mocked(deps.logEvent).mock.calls[0]!
    expect(event).toBe('api_token.revoked')
    expect(JSON.stringify(fields)).toContain(TOKEN_ID)
  })

  it('200 idempotent on an already-revoked token — no second update, no event', async () => {
    const deps = makeDeps({
      fetchTokenForOrg: vi.fn(async () => ({ id: TOKEN_ID, isActive: false })),
    })
    const res = await post(TOKEN_ID, makeAccount(), deps)
    expect(res.status).toBe(200)
    expect(deps.revokeToken).not.toHaveBeenCalled()
    expect(deps.logEvent).not.toHaveBeenCalled()
  })
})
