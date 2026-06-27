/**
 * Tests for the testable inner handler (handlePost) in restore.ts.
 *
 * The Astro APIRoute wrapper wires real Drizzle + cloudflare:workers env at
 * runtime; the inner handler takes all deps as arguments so vitest can run
 * it in plain Node with vi.fn() stubs.
 *
 * `cloudflare:workers` is mocked because importing the route file pulls the
 * static import at the top. The mock is stub-only — we never call the outer
 * POST wrapper in tests.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost } = await import('./restore')

import type { AccountContext } from '../../../../lib/account'
import type { HandlePostDeps, InsertRestoreRunInput } from './restore'
import type { EngineStartRestoreResult } from '../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'
const SOURCE_RUN_ID = '33333333-3333-3333-3333-333333333333'
const RESTORE_ID = '44444444-4444-4444-4444-444444444444'
const CONN_ID = '55555555-5555-5555-5555-555555555555'
const BASE_ID = 'appXXXXXXXXXXX'

function makeAccount(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    user: {
      id: 'u_1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      image: null,
    },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Acme', status: 'active' }],
    ...overrides,
  } as AccountContext
}

function makeDeps(overrides: Partial<HandlePostDeps> = {}): HandlePostDeps {
  return {
    fetchSpaceById: vi.fn(async () => ({
      id: SPACE_ID,
      organizationId: ORG_ID,
    })),
    fetchAirtableConnectionForOrg: vi.fn(async () => ({
      id: CONN_ID,
      organizationId: ORG_ID,
      status: 'active',
    })),
    fetchSourceRun: vi.fn(async () => ({
      id: SOURCE_RUN_ID,
      spaceId: SPACE_ID,
      status: 'succeeded',
    })),
    insertRestoreRun: vi.fn(async () => RESTORE_ID),
    deleteRestoreRun: vi.fn(async () => {}),
    engineStartRestore: vi.fn(
      async (): Promise<EngineStartRestoreResult> => ({
        ok: true,
        restoreId: RESTORE_ID,
        triggerRunId: 'run_r1',
      }),
    ),
    ...overrides,
  }
}

function validBody() {
  return {
    sourceRunId: SOURCE_RUN_ID,
    scope: 'base' as const,
    scopeTarget: { baseId: BASE_ID },
  }
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

describe('POST /api/spaces/:spaceId/restore → handlePost', () => {
  // ── Auth ──────────────────────────────────────────────────────────────

  it('returns 401 when account is null', async () => {
    const res = await handlePost({
      account: null,
      spaceId: SPACE_ID,
      body: validBody(),
      deps: makeDeps(),
    })
    expect(res.status).toBe(401)
    expect(await readJson(res)).toEqual({ error: 'Not authenticated' })
  })

  it('returns 401 when organization is missing from account', async () => {
    const res = await handlePost({
      account: makeAccount({ organization: null }),
      spaceId: SPACE_ID,
      body: validBody(),
      deps: makeDeps(),
    })
    expect(res.status).toBe(401)
  })

  // ── URL param validation ──────────────────────────────────────────────

  it('returns 400 when spaceId is undefined', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: undefined,
      body: validBody(),
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
    expect(await readJson(res)).toEqual({ error: 'invalid_request' })
  })

  it('returns 400 when spaceId is not a UUID', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: 'not-a-uuid',
      body: validBody(),
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
  })

  // ── Body validation ───────────────────────────────────────────────────

  it('returns 400 when body is null', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: null,
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
    expect(await readJson(res)).toEqual({ error: 'invalid_request' })
  })

  it('returns 400 when sourceRunId is missing', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { scope: 'base', scopeTarget: { baseId: BASE_ID } },
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when sourceRunId is not a UUID', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { sourceRunId: 'not-a-uuid', scope: 'base', scopeTarget: { baseId: BASE_ID } },
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when scope is missing', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { sourceRunId: SOURCE_RUN_ID, scopeTarget: { baseId: BASE_ID } },
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when scope is invalid', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { sourceRunId: SOURCE_RUN_ID, scope: 'invalid', scopeTarget: { baseId: BASE_ID } },
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when scopeTarget.baseId is missing', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { sourceRunId: SOURCE_RUN_ID, scope: 'base', scopeTarget: {} },
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when scope is table and tableId is missing from scopeTarget', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: { sourceRunId: SOURCE_RUN_ID, scope: 'table', scopeTarget: { baseId: BASE_ID } },
      deps: makeDeps(),
    })
    expect(res.status).toBe(400)
  })

  // ── IDOR guard ────────────────────────────────────────────────────────

  it('returns 403 when space does not exist', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: validBody(),
      deps: makeDeps({
        fetchSpaceById: vi.fn(async () => null),
      }),
    })
    expect(res.status).toBe(403)
    expect(await readJson(res)).toEqual({ error: 'space_not_found' })
  })

  it('returns 403 when space is in another org (IDOR)', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: validBody(),
      deps: makeDeps({
        fetchSpaceById: vi.fn(async () => ({
          id: SPACE_ID,
          organizationId: 'other-org',
        })),
      }),
    })
    expect(res.status).toBe(403)
    expect(await readJson(res)).toEqual({ error: 'space_org_mismatch' })
  })

  // ── Source run guard ──────────────────────────────────────────────────

  it('returns 404 when source run does not exist in this space', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: validBody(),
      deps: makeDeps({
        fetchSourceRun: vi.fn(async () => null),
      }),
    })
    expect(res.status).toBe(404)
    expect(await readJson(res)).toEqual({ error: 'source_run_not_found' })
  })

  it('returns 422 when source run status is not restorable', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: validBody(),
      deps: makeDeps({
        fetchSourceRun: vi.fn(async () => ({
          id: SOURCE_RUN_ID,
          spaceId: SPACE_ID,
          status: 'failed',
        })),
      }),
    })
    expect(res.status).toBe(422)
    expect(await readJson(res)).toEqual({ error: 'source_run_not_restorable' })
  })

  // ── Connection guard ──────────────────────────────────────────────────

  it('returns 422 when no active Airtable connection exists', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: validBody(),
      deps: makeDeps({
        fetchAirtableConnectionForOrg: vi.fn(async () => null),
      }),
    })
    expect(res.status).toBe(422)
    expect(await readJson(res)).toEqual({ error: 'no_active_connection' })
  })

  // ── Happy path ────────────────────────────────────────────────────────

  it('returns 200 with restoreId on success', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: validBody(),
      deps: makeDeps(),
    })
    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({ restoreId: RESTORE_ID })
  })

  it('calls insertRestoreRun with correct fields', async () => {
    let capturedInsert: InsertRestoreRunInput | null = null
    const insertRestoreRun = async (input: InsertRestoreRunInput) => {
      capturedInsert = input
      return RESTORE_ID
    }
    await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: validBody(),
      deps: makeDeps({ insertRestoreRun }),
    })
    expect(capturedInsert).not.toBeNull()
    expect(capturedInsert!.spaceId).toBe(SPACE_ID)
    expect(capturedInsert!.connectionId).toBe(CONN_ID)
    expect(capturedInsert!.sourceRunId).toBe(SOURCE_RUN_ID)
    expect(capturedInsert!.status).toBe('queued')
    expect(capturedInsert!.triggeredBy).toBe('user_manual')
    expect(capturedInsert!.isTrial).toBe(false)
    expect(capturedInsert!.scope).toBe('base')
    expect(capturedInsert!.scopeTarget).toEqual({ baseId: BASE_ID })
  })

  it('calls engineStartRestore with the new restore row id', async () => {
    const engineStartRestore = vi.fn(
      async (): Promise<EngineStartRestoreResult> => ({
        ok: true,
        restoreId: RESTORE_ID,
        triggerRunId: 'run_r1',
      }),
    )
    await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: validBody(),
      deps: makeDeps({ engineStartRestore }),
    })
    expect(engineStartRestore).toHaveBeenCalledWith(RESTORE_ID)
  })

  // ── Engine failure rollback ───────────────────────────────────────────

  it('deletes the queued row and returns 503 when engine is unreachable', async () => {
    const deleteRestoreRun = vi.fn(async () => {})
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: validBody(),
      deps: makeDeps({
        deleteRestoreRun,
        engineStartRestore: vi.fn(
          async (): Promise<EngineStartRestoreResult> => ({
            ok: false,
            code: 'engine_unreachable',
            status: 0,
          }),
        ),
      }),
    })
    expect(res.status).toBe(503)
    expect(deleteRestoreRun).toHaveBeenCalledWith(RESTORE_ID)
  })

  it('deletes the queued row and returns 404 when engine reports restore_not_found', async () => {
    const deleteRestoreRun = vi.fn(async () => {})
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: validBody(),
      deps: makeDeps({
        deleteRestoreRun,
        engineStartRestore: vi.fn(
          async (): Promise<EngineStartRestoreResult> => ({
            ok: false,
            code: 'restore_not_found',
            status: 404,
          }),
        ),
      }),
    })
    expect(res.status).toBe(404)
    expect(deleteRestoreRun).toHaveBeenCalledWith(RESTORE_ID)
  })

  it('accepts scope=table when tableId is present in scopeTarget', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      body: {
        sourceRunId: SOURCE_RUN_ID,
        scope: 'table',
        scopeTarget: { baseId: BASE_ID, tableId: 'tbl123' },
      },
      deps: makeDeps(),
    })
    expect(res.status).toBe(200)
  })
})
