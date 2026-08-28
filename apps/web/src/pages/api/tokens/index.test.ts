/**
 * Tests for the testable inner handler (handlePost) in index.ts — API token
 * creation (openspec/changes/web-api-tokens, design D1/D2/D3/D7).
 *
 * Mirrors delete.test.ts: `cloudflare:workers` mocked at module load, tests
 * exercise the inner handler with vi.fn() deps. The mint step is injected so
 * assertions can pin that only hash+prefix persist — never the plaintext.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost, ALLOWED_SCOPES, EXPIRY_PRESET_DAYS } = await import('./index')

import type { AccountContext } from '../../../lib/account'
import type { HandlePostDeps } from './index'

const ORG_ID = '22222222-2222-2222-2222-222222222222'
const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_SPACE_ID = '99999999-9999-9999-9999-999999999999'

const MINTED = {
  token: 'bo_live_PLAINTEXT_ONLY_IN_RESPONSE',
  tokenPrefix: 'bo_live_PLAINT',
  tokenHash: 'a'.repeat(64),
}

function makeAccount(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@example.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Main', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Main', status: 'active' }],
    ...overrides,
  } as AccountContext
}

function makeDeps(overrides: Partial<HandlePostDeps> = {}): HandlePostDeps {
  return {
    mint: vi.fn(async () => ({ ...MINTED })),
    fetchSpaceForOrg: vi.fn(async (spaceId: string) =>
      spaceId === SPACE_ID ? { id: SPACE_ID } : null,
    ),
    insertToken: vi.fn(async (values) => ({
      id: 'tok_row_1',
      name: values.name,
      tokenPrefix: values.tokenPrefix,
      scopes: values.scopes,
      spaceId: values.spaceId,
      isActive: true,
      expiresAt: values.expiresAt,
      lastUsedAt: null,
      createdAt: new Date('2026-07-21T00:00:00Z'),
    })),
    logEvent: vi.fn(),
    now: () => new Date('2026-07-21T00:00:00Z'),
    ...overrides,
  }
}

const validBody = () => ({
  name: 'CI reader',
  scopes: ['backups:read'],
})

async function post(
  body: unknown,
  account: AccountContext | null = makeAccount(),
  deps: HandlePostDeps = makeDeps(),
): Promise<Response> {
  return handlePost({ account, body, deps })
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

describe('handlePost — auth + role gate (D2)', () => {
  it('401 when account is null', async () => {
    expect((await post(validBody(), null)).status).toBe(401)
  })

  it('401 when organization is missing', async () => {
    const res = await post(validBody(), makeAccount({ organization: null } as never))
    expect(res.status).toBe(401)
  })

  it('403 forbidden for member role — owner/admin only', async () => {
    const res = await post(
      validBody(),
      makeAccount({ membership: { role: 'member', isDefault: true } } as never),
    )
    expect(res.status).toBe(403)
    expect((await readJson(res)).error).toBe('forbidden')
  })

  it('admin role is allowed', async () => {
    const res = await post(
      validBody(),
      makeAccount({ membership: { role: 'admin', isDefault: false } } as never),
    )
    expect(res.status).toBe(201)
  })
})

describe('handlePost — validation matrix (D7)', () => {
  it('400 on non-object body', async () => {
    expect((await post(null)).status).toBe(400)
    expect((await post('x')).status).toBe(400)
  })

  it.each([
    ['missing name', { scopes: ['org:read'] }],
    ['empty name after trim', { name: '   ', scopes: ['org:read'] }],
    ['name over 100 chars', { name: 'x'.repeat(101), scopes: ['org:read'] }],
  ])('400 invalid_name — %s', async (_label, body) => {
    const res = await post(body)
    expect(res.status).toBe(400)
    expect((await readJson(res)).error).toBe('invalid_name')
  })

  it.each([
    ['missing scopes', { name: 'ok' }],
    ['empty scopes', { name: 'ok', scopes: [] }],
    ['non-array scopes', { name: 'ok', scopes: 'org:read' }],
    ['unknown scope', { name: 'ok', scopes: ['org:read', 'backups:write'] }],
  ])('400 invalid_scopes — %s', async (_label, body) => {
    const res = await post(body)
    expect(res.status).toBe(400)
    expect((await readJson(res)).error).toBe('invalid_scopes')
  })

  it('400 invalid_space when spaceId is not a Space of the Organization', async () => {
    const res = await post({ ...validBody(), spaceId: OTHER_SPACE_ID })
    expect(res.status).toBe(400)
    expect((await readJson(res)).error).toBe('invalid_space')
  })

  it('400 invalid_expiry when expiresInDays is not an offered preset', async () => {
    const res = await post({ ...validBody(), expiresInDays: 7 })
    expect(res.status).toBe(400)
    expect((await readJson(res)).error).toBe('invalid_expiry')
  })

  it('exposes the allow-lists the UI renders from', () => {
    expect(ALLOWED_SCOPES).toEqual([
      'org:read',
      'backups:read',
      'schema:read',
      'documents:read',
      'documents:write',
      'reports:read',
      'reports:write',
      'views:read',
      'views:write',
      'data:read',
    ])
    expect(EXPIRY_PRESET_DAYS).toEqual([30, 90, 365])
  })
})

describe('handlePost — creation (D3: plaintext once, hash+prefix persisted)', () => {
  it('201 returns the plaintext token exactly once alongside the row view', async () => {
    const deps = makeDeps()
    const res = await post(validBody(), makeAccount(), deps)
    expect(res.status).toBe(201)
    const body = await readJson(res)
    expect(body.token).toBe(MINTED.token)
    const row = body.row as Record<string, unknown>
    expect(row.name).toBe('CI reader')
    expect(row.tokenPrefix).toBe(MINTED.tokenPrefix)
    expect(row.status).toBe('active')
    // The row view never carries the plaintext or the hash.
    expect(JSON.stringify(row)).not.toContain(MINTED.token)
    expect(JSON.stringify(row)).not.toContain(MINTED.tokenHash)
  })

  it('persists hash + prefix + org from the session — never the plaintext', async () => {
    const deps = makeDeps()
    await post({ ...validBody(), organizationId: 'attacker-org' }, makeAccount(), deps)
    expect(deps.insertToken).toHaveBeenCalledTimes(1)
    const values = vi.mocked(deps.insertToken).mock.calls[0]![0]
    expect(values.organizationId).toBe(ORG_ID) // session wins over body
    expect(values.tokenHash).toBe(MINTED.tokenHash)
    expect(values.tokenPrefix).toBe(MINTED.tokenPrefix)
    expect(values.createdByUserId).toBe('u_1')
    expect(JSON.stringify(values)).not.toContain(MINTED.token)
  })

  it('binds to a Space of the org when spaceId is given; null means all Spaces', async () => {
    const deps = makeDeps()
    await post({ ...validBody(), spaceId: SPACE_ID }, makeAccount(), deps)
    expect(vi.mocked(deps.insertToken).mock.calls[0]![0].spaceId).toBe(SPACE_ID)

    const deps2 = makeDeps()
    await post(validBody(), makeAccount(), deps2)
    expect(vi.mocked(deps2.insertToken).mock.calls[0]![0].spaceId).toBeNull()
  })

  it('computes expires_at from the preset relative to now', async () => {
    const deps = makeDeps()
    await post({ ...validBody(), expiresInDays: 30 }, makeAccount(), deps)
    const values = vi.mocked(deps.insertToken).mock.calls[0]![0]
    expect(values.expiresAt?.toISOString()).toBe('2026-08-20T00:00:00.000Z')
  })

  it('emits the api_token.created event without plaintext or hash', async () => {
    const deps = makeDeps()
    await post(validBody(), makeAccount(), deps)
    expect(deps.logEvent).toHaveBeenCalledTimes(1)
    const [event, fields] = vi.mocked(deps.logEvent).mock.calls[0]!
    expect(event).toBe('api_token.created')
    const serialized = JSON.stringify(fields)
    expect(serialized).toContain(ORG_ID)
    expect(serialized).not.toContain(MINTED.token)
    expect(serialized).not.toContain(MINTED.tokenHash)
  })
})
