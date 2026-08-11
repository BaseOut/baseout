/**
 * Tests for the BYOK key-management handlers (shared-ai-byok 2.1/2.2). DI inner
 * handlers exercised with fakes; `cloudflare:workers` mocked at module load. The
 * plaintext key is injected into `persist` and never asserted back out of a
 * response — the API returns display-only fields.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: { BASEOUT_ENCRYPTION_KEY: 'k' } }))

const { handleGet, handlePost, handleDelete, PROVIDERS } = await import('./index')

import type { AccountContext } from '../../../lib/account'
import type { HandleDeps } from './index'

const ORG = '22222222-2222-2222-2222-222222222222'

function makeAccount(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@acme.com', image: null },
    organization: { id: ORG, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: null,
    spaces: [],
    ...overrides,
  } as AccountContext
}

function makeDeps(overrides: Partial<HandleDeps> = {}): HandleDeps {
  return {
    listKeys: vi.fn(async () => [
      {
        provider: 'anthropic',
        label: 'prod',
        modelDefault: null,
        lastFour: 'cdef',
        status: 'active',
        lastValidatedAt: null,
      },
    ]),
    isByokEntitled: vi.fn(async () => true),
    persist: vi.fn(async (i) => ({
      provider: i.provider,
      lastFour: i.plaintextKey.slice(-4),
      keyFingerprint: 'f'.repeat(64),
      status: 'active' as const,
      rotated: false,
    })),
    revoke: vi.fn(async () => true),
    checkKey: vi.fn(async () => ({ ok: true })),
    audit: vi.fn(async () => {}),
    ...overrides,
  }
}

async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>
}

describe('handleGet — list keys', () => {
  it('401 unauthenticated', async () => {
    expect((await handleGet({ account: null, deps: makeDeps() })).status).toBe(401)
  })
  it('403 without an active org', async () => {
    const account = makeAccount({ organization: undefined })
    expect((await handleGet({ account, deps: makeDeps() })).status).toBe(403)
  })
  it('returns display-only keys (never key material)', async () => {
    const res = await handleGet({ account: makeAccount(), deps: makeDeps() })
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.keys).toEqual([
      {
        provider: 'anthropic',
        label: 'prod',
        modelDefault: null,
        lastFour: 'cdef',
        status: 'active',
        lastValidatedAt: null,
      },
    ])
    expect(JSON.stringify(body)).not.toContain('key_enc')
  })
})

describe('handlePost — add / rotate a key', () => {
  it('401 unauthenticated', async () => {
    const res = await handlePost({ account: null, body: {}, deps: makeDeps() })
    expect(res.status).toBe(401)
  })
  it('400 on an unknown provider', async () => {
    const res = await handlePost({
      account: makeAccount(),
      body: { provider: 'gemini', key: 'sk-123456' },
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
  })
  it('400 on a missing/blank key', async () => {
    const res = await handlePost({
      account: makeAccount(),
      body: { provider: 'anthropic', key: '   ' },
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
  })
  it('403 for a non-admin member (credential surface is owner/admin-only)', async () => {
    const deps = makeDeps()
    const res = await handlePost({
      account: makeAccount({ membership: { role: 'member', isDefault: false } }),
      body: { provider: 'anthropic', key: 'sk-abcdef' },
      deps,
    })
    expect(res.status).toBe(403)
    expect((await json(res)).code).toBe('forbidden')
    expect(deps.persist).not.toHaveBeenCalled()
    expect(deps.isByokEntitled).not.toHaveBeenCalled()
  })
  it('403 when the org is not BYOK-entitled (below Plus)', async () => {
    const deps = makeDeps({ isByokEntitled: vi.fn(async () => false) })
    const res = await handlePost({
      account: makeAccount(),
      body: { provider: 'anthropic', key: 'sk-abcdef' },
      deps,
    })
    expect(res.status).toBe(403)
    expect((await json(res)).code).toBe('not_entitled')
    expect(deps.persist).not.toHaveBeenCalled()
  })
  it('200 persists and returns display-only fields (no plaintext echoed)', async () => {
    const deps = makeDeps()
    const res = await handlePost({
      account: makeAccount(),
      body: { provider: 'anthropic', key: 'sk-secret-WXYZ', label: 'prod' },
      deps,
    })
    expect(res.status).toBe(200)
    expect(deps.persist).toHaveBeenCalledWith({
      organizationId: ORG,
      provider: 'anthropic',
      plaintextKey: 'sk-secret-WXYZ',
      label: 'prod',
      modelDefault: null,
      createdByUserId: 'u_1',
    })
    const body = await json(res)
    expect(body).toMatchObject({ ok: true, key: { provider: 'anthropic', lastFour: 'WXYZ', status: 'active' } })
    expect(JSON.stringify(body)).not.toContain('sk-secret')
  })

  it('400 key_validation_failed when the health-check fails — never persists, never audits', async () => {
    const deps = makeDeps({
      checkKey: vi.fn(async () => ({ ok: false, error: 'Anthropic key validation failed (HTTP 401)' })),
    })
    const res = await handlePost({
      account: makeAccount(),
      body: { provider: 'anthropic', key: 'sk-bad-KEY9' },
      deps,
    })
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.code).toBe('key_validation_failed')
    expect(body.error).toBe('Anthropic key validation failed (HTTP 401)')
    // A failing key must never be stored active, and nothing is audited.
    expect(deps.checkKey).toHaveBeenCalledWith('anthropic', 'sk-bad-KEY9')
    expect(deps.persist).not.toHaveBeenCalled()
    expect(deps.audit).not.toHaveBeenCalled()
  })

  it('health-checks AFTER the entitlement gate (un-entitled never reaches checkKey)', async () => {
    const deps = makeDeps({ isByokEntitled: vi.fn(async () => false) })
    await handlePost({ account: makeAccount(), body: { provider: 'anthropic', key: 'sk-abcd' }, deps })
    expect(deps.checkKey).not.toHaveBeenCalled()
  })

  it('200 valid add → audits ai_key_added with metadata only (never the key)', async () => {
    const deps = makeDeps()
    const res = await handlePost({
      account: makeAccount(),
      body: { provider: 'anthropic', key: 'sk-secret-WXYZ', label: 'prod' },
      deps,
    })
    expect(res.status).toBe(200)
    expect(deps.audit).toHaveBeenCalledTimes(1)
    const event = (deps.audit as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(event).toMatchObject({
      action: 'ai_key_added',
      organizationId: ORG,
      actorUserId: 'u_1',
      provider: 'anthropic',
      lastFour: 'WXYZ',
    })
    // the audit event must NEVER carry key material
    expect(JSON.stringify(event)).not.toContain('sk-secret')
  })

  it('200 rotate (existing active key replaced) → audits ai_key_rotated', async () => {
    const deps = makeDeps({
      persist: vi.fn(async (i) => ({
        provider: i.provider,
        lastFour: i.plaintextKey.slice(-4),
        keyFingerprint: 'f'.repeat(64),
        status: 'active' as const,
        rotated: true,
      })),
    })
    await handlePost({
      account: makeAccount(),
      body: { provider: 'anthropic', key: 'sk-rotated-0000' },
      deps,
    })
    const event = (deps.audit as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(event.action).toBe('ai_key_rotated')
  })
})

describe('handleDelete — revoke a key', () => {
  it('400 on an unknown provider', async () => {
    const res = await handleDelete({ account: makeAccount(), body: { provider: 'nope' }, deps: makeDeps() })
    expect(res.status).toBe(400)
  })
  it('revokes the active key for the provider', async () => {
    const deps = makeDeps()
    const res = await handleDelete({ account: makeAccount(), body: { provider: 'anthropic' }, deps })
    expect(res.status).toBe(200)
    expect(deps.revoke).toHaveBeenCalledWith(ORG, 'anthropic')
  })
  it('audits ai_key_revoked on a successful revoke (metadata only)', async () => {
    const deps = makeDeps()
    await handleDelete({ account: makeAccount(), body: { provider: 'anthropic' }, deps })
    expect(deps.audit).toHaveBeenCalledTimes(1)
    const event = (deps.audit as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(event).toMatchObject({ action: 'ai_key_revoked', organizationId: ORG, actorUserId: 'u_1', provider: 'anthropic' })
  })
  it('does NOT audit when nothing was revoked (no active key)', async () => {
    const deps = makeDeps({ revoke: vi.fn(async () => false) })
    await handleDelete({ account: makeAccount(), body: { provider: 'anthropic' }, deps })
    expect(deps.audit).not.toHaveBeenCalled()
  })
  it('403 for a non-admin member', async () => {
    const deps = makeDeps()
    const res = await handleDelete({
      account: makeAccount({ membership: { role: 'member', isDefault: false } }),
      body: { provider: 'anthropic' },
      deps,
    })
    expect(res.status).toBe(403)
    expect(deps.revoke).not.toHaveBeenCalled()
  })
  it('exposes the provider allow-list', () => {
    expect(PROVIDERS).toContain('anthropic')
  })
})
