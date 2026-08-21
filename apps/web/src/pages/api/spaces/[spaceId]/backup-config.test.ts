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
    // server-backup-scope: the route reads the post-upsert schedule before the
    // hand-off. Default returns a full schedule; hand-off tests override.
    fetchScheduleForSpace: vi.fn(async () => ({
      scope: 'schema_and_data',
      dataFrequency: 'monthly',
      schemaFrequency: null,
    })),
    // Setup promotion: defaults to a no-op vi.fn(). Tests asserting on it
    // override; tests not asserting don't care.
    promoteSpaceIfReady: vi.fn(async () => {}),
    ensureInternalSpaceReady: vi.fn(async () => {}),
    // Multi-destination: swap-primary validation. Defaults to "connected"
    // so existing tests pass unchanged; the swap tests override.
    hasConnectedDestination: vi.fn(async () => true),
    // web-instant-webhook: Instant needs the Space's dynamic DB. Defaults
    // ready so pre-existing tests pass unchanged.
    isDynamicDbReady: vi.fn(async () => true),
    // web-instant-webhook: engine webhook lifecycle (server E.5 wiring).
    // Null mirrors onScheduledFrequencyChange — engine binding may be absent.
    registerWebhooks: null,
    unregisterWebhooks: null,
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
    // 's3' stands in as the canonical unsupported example now that
    // 'onedrive' has joined the allow list with the onedrive-provider chain.
    const d = makeDeps()
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { storageType: 's3' },
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

  it('ensures internal Space readiness after a successful save', async () => {
    const d = makeDeps()
    const res = await handlePatch({
      account: makeAccount({ user: { id: 'u_1', name: 'Ada', email: 'ada@openside.com', image: null } }),
      spaceId: SPACE_ID,
      body: { frequency: 'daily' },
      ...d,
    })

    expect(res.status).toBe(200)
    expect(d.ensureInternalSpaceReady).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      spaceId: SPACE_ID,
      userId: 'u_1',
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

  it('hands off the full post-upsert schedule on a successful schedule PATCH', async () => {
    const schedule = { scope: 'schema_and_data', dataFrequency: 'daily', schemaFrequency: null }
    const onScheduledFrequencyChange = vi.fn(async () => undefined)
    const d = makeDeps({
      onScheduledFrequencyChange,
      fetchScheduleForSpace: vi.fn(async () => schedule),
    })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'daily' },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(onScheduledFrequencyChange).toHaveBeenCalledWith(SPACE_ID, schedule)
  })

  it('persists scope + schema cadence and fires the hand-off (server-backup-scope)', async () => {
    const onScheduledFrequencyChange = vi.fn(async () => undefined)
    const d = makeDeps({ onScheduledFrequencyChange })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { scope: 'schema_only', schemaFrequency: 'daily' },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(d.upsertConfig).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      scope: 'schema_only',
      schemaFrequency: 'daily',
    })
    expect(onScheduledFrequencyChange).toHaveBeenCalled()
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

  it("accepts frequency='instant' and still fires the hand-off (engine ignores the un-schedulable cadence)", async () => {
    // Pre-dual, the route skipped the hand-off for instant. Now it always
    // hands off the full schedule; the engine's parseScheduleBody rejects an
    // instant cadence (so no alarm is armed for it) while still arming any
    // schedulable schema cadence on the same Space. The route swallows the
    // engine's 400. 'instant' needs Business+ per Features §6.1.
    const onScheduledFrequencyChange = vi.fn(async () => undefined)
    const d = makeDeps({
      onScheduledFrequencyChange,
      resolveTier: vi.fn(async () => 'business' as const),
    })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'instant' },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(onScheduledFrequencyChange).toHaveBeenCalled()
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

  // ── Swap-primary validation (shared-multi-destinations) ─────────────────

  it('rejects a BYOS storageType with no connected row (422 destination_not_connected)', async () => {
    const hasConnectedDestination = vi.fn(async () => false)
    const d = makeDeps({ hasConnectedDestination })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { storageType: 'box' },
      ...d,
    })
    expect(res.status).toBe(422)
    expect(await readJson(res)).toEqual({ error: 'destination_not_connected' })
    expect(hasConnectedDestination).toHaveBeenCalledWith(SPACE_ID, 'box')
    expect(d.upsertConfig).not.toHaveBeenCalled()
  })

  it('accepts a BYOS storageType with a connected row', async () => {
    const hasConnectedDestination = vi.fn(async () => true)
    const d = makeDeps({ hasConnectedDestination })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { storageType: 'google_drive' },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(d.upsertConfig).toHaveBeenCalled()
  })

  it('skips the row check for managed types (r2_managed, local_fs)', async () => {
    for (const storageType of ['r2_managed', 'local_fs']) {
      const hasConnectedDestination = vi.fn(async () => false)
      const d = makeDeps({ hasConnectedDestination })
      const res = await handlePatch({
        account: makeAccount(),
        spaceId: SPACE_ID,
        body: { storageType },
        ...d,
      })
      expect(res.status).toBe(200)
      expect(hasConnectedDestination).not.toHaveBeenCalled()
    }
  })
})

// ── web-instant-webhook ─────────────────────────────────────────────────────

describe('handlePatch — instant frequency (web-instant-webhook)', () => {
  it("accepts frequency='instant' for pro (PRD §2.2 ruling)", async () => {
    const d = makeDeps({ resolveTier: vi.fn(async () => 'pro' as const) })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'instant' },
      ...d,
    })
    expect(res.status).toBe(200)
  })

  it('rejects instant when the dynamic DB is not ready (422 dynamic_db_not_ready)', async () => {
    const d = makeDeps({ isDynamicDbReady: vi.fn(async () => false) })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'instant' },
      ...d,
    })
    expect(res.status).toBe(422)
    expect(await readJson(res)).toEqual({ error: 'dynamic_db_not_ready' })
    expect(d.upsertConfig).not.toHaveBeenCalled()
  })

  it('skips the dynamic-DB check for non-instant frequencies', async () => {
    const isDynamicDbReady = vi.fn(async () => false)
    const d = makeDeps({ isDynamicDbReady })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'daily' },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(isDynamicDbReady).not.toHaveBeenCalled()
  })

  it('rejects a below-minimum poll interval with the tier minimum echoed', async () => {
    const d = makeDeps({ resolveTier: vi.fn(async () => 'pro' as const) })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { webhookPollIntervalSeconds: 60 },
      ...d,
    })
    expect(res.status).toBe(422)
    expect(await readJson(res)).toEqual({
      error: 'webhook_poll_interval_below_minimum',
      minimum: 900,
    })
    expect(d.upsertConfig).not.toHaveBeenCalled()
  })

  it('upserts frequency + interval together on the happy path', async () => {
    const d = makeDeps({ resolveTier: vi.fn(async () => 'business' as const) })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'instant', webhookPollIntervalSeconds: 300 },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(d.upsertConfig).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      frequency: 'instant',
      webhookPollIntervalSeconds: 300,
    })
  })
})

describe('handlePatch — webhook registration handoff (server E.5 wiring)', () => {
  it('registers webhooks on the transition TO instant', async () => {
    const registerWebhooks = vi.fn(async () => ({ ok: true as const }))
    const d = makeDeps({
      registerWebhooks,
      fetchScheduleForSpace: vi.fn(async () => ({
        scope: 'schema_and_data',
        dataFrequency: 'daily',
        schemaFrequency: null,
      })),
    })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'instant' },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(registerWebhooks).toHaveBeenCalledWith(SPACE_ID)
  })

  it('does NOT register when the Space is already on instant', async () => {
    const registerWebhooks = vi.fn(async () => ({ ok: true as const }))
    const d = makeDeps({
      registerWebhooks,
      fetchScheduleForSpace: vi.fn(async () => ({
        scope: 'schema_and_data',
        dataFrequency: 'instant',
        schemaFrequency: null,
      })),
    })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'instant', webhookPollIntervalSeconds: 900 },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(registerWebhooks).not.toHaveBeenCalled()
  })

  it('unregisters webhooks on the transition AWAY from instant', async () => {
    const unregisterWebhooks = vi.fn(async () => ({ ok: true as const }))
    const d = makeDeps({
      unregisterWebhooks,
      fetchScheduleForSpace: vi.fn(async () => ({
        scope: 'schema_and_data',
        dataFrequency: 'instant',
        schemaFrequency: null,
      })),
    })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'daily' },
      ...d,
    })
    expect(res.status).toBe(200)
    expect(unregisterWebhooks).toHaveBeenCalledWith(SPACE_ID)
  })

  it('cap reached ⇒ reverts the frequency and returns 409 airtable_webhook_cap_reached', async () => {
    const registerWebhooks = vi.fn(async () => ({
      ok: false as const,
      code: 'airtable_webhook_cap_reached' as const,
      status: 409,
    }))
    const onScheduledFrequencyChange = vi.fn(async () => undefined)
    const d = makeDeps({
      registerWebhooks,
      onScheduledFrequencyChange,
      fetchScheduleForSpace: vi.fn(async () => ({
        scope: 'schema_and_data',
        dataFrequency: 'daily',
        schemaFrequency: null,
      })),
    })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'instant' },
      ...d,
    })
    expect(res.status).toBe(409)
    expect(await readJson(res)).toEqual({ error: 'airtable_webhook_cap_reached' })
    // First upsert wrote instant; the compensating upsert restored the
    // previous cadence so config and (absent) webhook rows can't drift.
    expect(d.upsertConfig).toHaveBeenLastCalledWith({
      spaceId: SPACE_ID,
      frequency: 'daily',
    })
    // No schedule handoff for a reverted save.
    expect(onScheduledFrequencyChange).not.toHaveBeenCalled()
  })

  it('cap revert falls back to monthly when no config existed before', async () => {
    const registerWebhooks = vi.fn(async () => ({
      ok: false as const,
      code: 'airtable_webhook_cap_reached' as const,
      status: 409,
    }))
    const d = makeDeps({
      registerWebhooks,
      fetchScheduleForSpace: vi.fn(async () => null),
    })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'instant' },
      ...d,
    })
    expect(res.status).toBe(409)
    expect(d.upsertConfig).toHaveBeenLastCalledWith({
      spaceId: SPACE_ID,
      frequency: 'monthly',
    })
  })

  it('other registration failures stay best-effort (200; daily safety sweep covers data)', async () => {
    const registerWebhooks = vi.fn(async () => ({
      ok: false as const,
      code: 'engine_unreachable' as const,
      status: 0,
    }))
    const d = makeDeps({ registerWebhooks })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'instant' },
      ...d,
    })
    expect(res.status).toBe(200)
  })

  it('unregister failures stay best-effort (200)', async () => {
    const unregisterWebhooks = vi.fn(async () => {
      throw new Error('engine down')
    })
    const d = makeDeps({
      unregisterWebhooks,
      fetchScheduleForSpace: vi.fn(async () => ({
        scope: 'schema_and_data',
        dataFrequency: 'instant',
        schemaFrequency: null,
      })),
    })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'monthly' },
      ...d,
    })
    expect(res.status).toBe(200)
  })

  it('handles null register/unregister deps (engine binding not wired)', async () => {
    const d = makeDeps({ registerWebhooks: null, unregisterWebhooks: null })
    const res = await handlePatch({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { frequency: 'instant' },
      ...d,
    })
    expect(res.status).toBe(200)
  })
})
