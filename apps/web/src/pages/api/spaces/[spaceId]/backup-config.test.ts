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
    // Phase B: defaults to null so existing tests that don't care about
    // the SpaceDO hand-off pass unchanged. Tests targeting the hand-off
    // override with vi.fn().
    onScheduledFrequencyChange: null,
    // Setup promotion: defaults to a no-op vi.fn(). Tests asserting on it
    // override; tests not asserting don't care.
    promoteSpaceIfReady: vi.fn(async () => {}),
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
    // 'onedrive' stands in as the canonical unsupported example now that
    // 'dropbox' has joined the allow list with the dropbox-provider chain.
    const d = makeDeps()
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { storageType: 'onedrive' },
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

  // Phase B: SpaceDO hand-off ─────────────────────────────────────────────

  it('calls onScheduledFrequencyChange with the new frequency on a successful PATCH', async () => {
    const onScheduledFrequencyChange = vi.fn(async () => undefined)
    const d = makeDeps({ onScheduledFrequencyChange })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'daily' },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(onScheduledFrequencyChange).toHaveBeenCalledWith(SPACE_ID, 'daily')
  })

  it('does NOT call onScheduledFrequencyChange when only storageType changed', async () => {
    const onScheduledFrequencyChange = vi.fn(async () => undefined)
    const d = makeDeps({ onScheduledFrequencyChange })
    await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { storageType: 'r2_managed' },
      ...d,
    })
    expect(onScheduledFrequencyChange).not.toHaveBeenCalled()
  })

  it("does NOT call onScheduledFrequencyChange for frequency='instant' (out of scope)", async () => {
    const onScheduledFrequencyChange = vi.fn(async () => undefined)
    // 'instant' is only allowed at Business+ per Features §6.1 — use that
    // tier so the policy doesn't reject the body before we get to the
    // hand-off decision. The point of the test is the hand-off skip,
    // not the tier gate.
    const d = makeDeps({
      onScheduledFrequencyChange,
      resolveTier: vi.fn(async () => 'business' as const),
    })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      // The PATCH should accept the new frequency but skip the SpaceDO
      // hand-off — instant is webhook-driven (separate change).
      body: { frequency: 'instant' },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(onScheduledFrequencyChange).not.toHaveBeenCalled()
  })

  it('still returns 200 when the SpaceDO hand-off throws (best-effort)', async () => {
    const onScheduledFrequencyChange = vi.fn(async () => {
      throw new Error('engine_unreachable')
    })
    const d = makeDeps({ onScheduledFrequencyChange })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'daily' },
      ...d,
    })
    // Hand-off failure must not undo the config UPSERT — the bootstrap
    // script catches up. Status stays 200.
    expect(res.status).toBe(200)
  })

  it('handles null onScheduledFrequencyChange (engine binding not wired)', async () => {
    const d = makeDeps({ onScheduledFrequencyChange: null })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'daily' },
      ...d,
    })
    expect(res.status).toBe(200)
  })

  // Setup-complete promotion ─────────────────────────────────────────────
  //
  // Saving the backup config is the canonical end-of-wizard signal: the user
  // has chosen frequency + storage type, so the Space is "set up enough" to
  // run a real backup. Promote spaces.status from 'setup_incomplete' to
  // 'active' here so the dashboard stops nagging with "Connect your first
  // base" once setup is done. Idempotent at the helper layer.

  it('calls promoteSpaceIfReady with the spaceId after a successful upsert', async () => {
    const promoteSpaceIfReady = vi.fn(async () => undefined)
    const d = makeDeps({ promoteSpaceIfReady })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'monthly' },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(promoteSpaceIfReady).toHaveBeenCalledWith(SPACE_ID)
  })

  it('does NOT call promoteSpaceIfReady when the upsert rejects with invalid_request', async () => {
    const promoteSpaceIfReady = vi.fn(async () => undefined)
    const d = makeDeps({ promoteSpaceIfReady })
    // Body that the policy will reject (unknown key).
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { unknown_field: 'x' },
      ...d,
    })
    expect(res.status).toBe(400)
    expect(promoteSpaceIfReady).not.toHaveBeenCalled()
  })

  it('still returns 200 when promoteSpaceIfReady throws (best-effort, mirrors hand-off)', async () => {
    const promoteSpaceIfReady = vi.fn(async () => {
      throw new Error('db_unreachable')
    })
    const d = makeDeps({ promoteSpaceIfReady })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'monthly' },
      ...d,
    })
    expect(res.status).toBe(200)
  })
})
