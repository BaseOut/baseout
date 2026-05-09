/**
 * Tests for the inner handlePatch — the testable PATCH /api/spaces/:id/
 * backup-config handler. Mirrors the backup-runs.test.ts pattern: import
 * the inner handler, pass vi.fn() deps, never touch real Drizzle.
 *
 * The Astro PATCH wrapper imports `cloudflare:workers` only via Drizzle
 * relative paths in this file, so vi.mock isn't strictly required here.
 * Add it defensively anyway in case someone wires an env import later.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePatch } = await import('./backup-config')

import type { AccountContext } from '../../../../lib/account'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'

function makeAccount(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@example.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Acme', status: 'active' }],
    ...overrides,
  } as AccountContext
}

function makeDeps(
  overrides: Partial<Parameters<typeof handlePatch>[0]> = {},
) {
  return {
    fetchSpaceById: vi.fn(async () => ({
      id: SPACE_ID,
      organizationId: ORG_ID,
    })),
    resolveTier: vi.fn(async () => 'pro' as const),
    upsertConfig: vi.fn(async () => {}),
    ...overrides,
  }
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

describe('handlePatch', () => {
  it('returns 401 when account is null', async () => {
    const d = makeDeps()
    const res = await handlePatch({
      account: null,
      spaceId: SPACE_ID,
      body: { frequency: 'monthly' },
      ...d,
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 when spaceId is missing', async () => {
    const d = makeDeps()
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: undefined,
      body: { frequency: 'monthly' },
      ...d,
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when spaceId is not a UUID', async () => {
    const d = makeDeps()
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: 'nope',
      body: { frequency: 'monthly' },
      ...d,
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is null', async () => {
    const d = makeDeps()
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: null,
      ...d,
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is an array', async () => {
    const d = makeDeps()
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      // arrays are typeof 'object' but not allowed
      body: ['nope'] as unknown as Record<string, unknown>,
      ...d,
    })
    expect(res.status).toBe(400)
  })

  it('returns 403 when space is in a different org', async () => {
    const d = makeDeps({
      fetchSpaceById: vi.fn(async () => ({
        id: SPACE_ID,
        organizationId: 'some-other-org',
      })),
    })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'monthly' },
      ...d,
    })
    expect(res.status).toBe(403)
    expect(await readJson(res)).toEqual({ error: 'space_org_mismatch' })
  })

  it('returns 403 when space does not exist', async () => {
    const d = makeDeps({ fetchSpaceById: vi.fn(async () => null) })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'monthly' },
      ...d,
    })
    expect(res.status).toBe(403)
    expect(await readJson(res)).toEqual({ error: 'space_not_found' })
  })

  it('returns 422 when frequency is above tier', async () => {
    const d = makeDeps({ resolveTier: vi.fn(async () => 'starter' as const) })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'daily' },
      ...d,
    })
    expect(res.status).toBe(422)
    expect(await readJson(res)).toEqual({ error: 'frequency_not_allowed' })
  })

  it('returns 422 when storageType is unsupported in MVP', async () => {
    const d = makeDeps()
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { storageType: 'dropbox' },
      ...d,
    })
    expect(res.status).toBe(422)
    expect(await readJson(res)).toEqual({ error: 'unsupported_storage_type' })
  })

  it('returns 400 when body has unknown keys', async () => {
    const d = makeDeps()
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { extraKey: 'nope' },
      ...d,
    })
    expect(res.status).toBe(400)
    expect(await readJson(res)).toEqual({ error: 'invalid_request' })
  })

  it('returns 200 and calls upsertConfig on the happy path', async () => {
    const d = makeDeps()
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'daily', storageType: 'r2_managed' },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({ ok: true })
    expect(d.upsertConfig).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      frequency: 'daily',
      storageType: 'r2_managed',
    })
  })

  it('upserts only frequency when only that field is sent', async () => {
    const d = makeDeps()
    await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'weekly' },
      ...d,
    })
    expect(d.upsertConfig).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      frequency: 'weekly',
    })
  })
})
