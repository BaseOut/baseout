/**
 * Tests for the testable inner handlers (handlePost / handleGet) in
 * backup-runs.ts. The Astro APIRoute wrappers (POST/GET) wire real Drizzle
 * + cloudflare:workers env at runtime; the inner handlers take all deps
 * as arguments so vitest can run them in plain Node with vi.fn() stubs.
 *
 * `cloudflare:workers` is mocked here because importing the route file
 * (even just to grab the inner handlers) pulls the static import at the
 * top. The mock is stub-only — we never call buildEngine() in tests.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const {
  handlePost,
  handleGet,
  statusForStartCode,
} = await import('./backup-runs')

import type { AccountContext } from '../../../../lib/account'
import type { StartBackupRunDeps } from '../../../../lib/backup-runs/start'
import type { BackupRunRowLike } from '../../../../lib/backup-runs/list'
import type { EngineStartRunResult } from '../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'
const RUN_ID = '33333333-3333-3333-3333-333333333333'

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

function makeStartDeps(
  overrides: Partial<StartBackupRunDeps> = {},
): StartBackupRunDeps {
  return {
    fetchSpaceById: vi.fn(async () => ({
      id: SPACE_ID,
      organizationId: ORG_ID,
    })),
    fetchAirtableConnection: vi.fn(async () => ({
      id: 'c_1',
      organizationId: ORG_ID,
      status: 'active',
    })),
    countIncludedBases: vi.fn(async () => 1),
    insertBackupRun: vi.fn(async () => RUN_ID),
    deleteBackupRun: vi.fn(async () => {}),
    engineStartRun: vi.fn(
      async (): Promise<EngineStartRunResult> => ({
        ok: true,
        runId: RUN_ID,
        triggerRunIds: ['run_a', 'run_b'],
      }),
    ),
    ...overrides,
  }
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

// ── POST tests ───────────────────────────────────────────────────────────

describe('handlePost', () => {
  it('returns 401 when account is null', async () => {
    const res = await handlePost({
      account: null,
      spaceId: SPACE_ID,
      startDeps: makeStartDeps(),
    })
    expect(res.status).toBe(401)
    expect(await readJson(res)).toEqual({ error: 'Not authenticated' })
  })

  it('returns 401 when organization is missing', async () => {
    const res = await handlePost({
      account: makeAccount({ organization: null }),
      spaceId: SPACE_ID,
      startDeps: makeStartDeps(),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 when spaceId is missing', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: undefined,
      startDeps: makeStartDeps(),
    })
    expect(res.status).toBe(400)
    expect(await readJson(res)).toEqual({ error: 'invalid_request' })
  })

  it('returns 400 when spaceId is not a UUID', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: 'not-a-uuid',
      startDeps: makeStartDeps(),
    })
    expect(res.status).toBe(400)
  })

  it('returns 200 with runId + triggerRunIds on the happy path', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      startDeps: makeStartDeps(),
    })
    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({
      runId: RUN_ID,
      triggerRunIds: ['run_a', 'run_b'],
    })
  })

  it('returns 422 when no bases are selected', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      startDeps: makeStartDeps({
        countIncludedBases: vi.fn(async () => 0),
      }),
    })
    expect(res.status).toBe(422)
    expect(await readJson(res)).toEqual({ error: 'no_bases_selected' })
  })

  it('returns 409 when the engine reports run_already_started', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      startDeps: makeStartDeps({
        engineStartRun: vi.fn(
          async (): Promise<EngineStartRunResult> => ({
            ok: false,
            code: 'run_already_started',
            status: 409,
          }),
        ),
      }),
    })
    expect(res.status).toBe(409)
    expect(await readJson(res)).toEqual({ error: 'run_already_started' })
  })

  it('returns 404 when the engine reports config_not_found', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      startDeps: makeStartDeps({
        engineStartRun: vi.fn(
          async (): Promise<EngineStartRunResult> => ({
            ok: false,
            code: 'config_not_found',
            status: 404,
          }),
        ),
      }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 when space is in another org', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      startDeps: makeStartDeps({
        fetchSpaceById: vi.fn(async () => ({
          id: SPACE_ID,
          organizationId: 'some-other-org',
        })),
      }),
    })
    expect(res.status).toBe(403)
    expect(await readJson(res)).toEqual({ error: 'space_org_mismatch' })
  })

  it('returns 422 when no Airtable connection exists', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      startDeps: makeStartDeps({
        fetchAirtableConnection: vi.fn(async () => null),
      }),
    })
    expect(res.status).toBe(422)
    expect(await readJson(res)).toEqual({ error: 'no_active_connection' })
  })

  it('returns 503 when the engine is unreachable (start helper rolls back)', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      startDeps: makeStartDeps({
        engineStartRun: vi.fn(
          async (): Promise<EngineStartRunResult> => ({
            ok: false,
            code: 'engine_unreachable',
            status: 0,
          }),
        ),
      }),
    })
    expect(res.status).toBe(503)
  })
})

// ── GET tests ────────────────────────────────────────────────────────────

const r1: BackupRunRowLike = {
  id: 'r_1',
  status: 'succeeded',
  isTrial: false,
  triggeredBy: 'manual',
  recordCount: 100,
  tableCount: 2,
  attachmentCount: 0,
  startedAt: new Date('2026-05-08T18:30:00.000Z'),
  completedAt: new Date('2026-05-08T18:31:00.000Z'),
  errorMessage: null,
  triggerRunIds: ['run_a'],
  createdAt: new Date('2026-05-08T18:30:00.000Z'),
  connectionId: 'conn_1',
  connectionDisplayName: 'Main Airtable',
  configStorageType: 'r2_managed',
  configMode: 'static',
}

describe('handleGet', () => {
  it('returns 401 when account is null', async () => {
    const res = await handleGet({
      account: null,
      spaceId: SPACE_ID,
      limitParam: null,
      fetchSpaceById: vi.fn(async () => ({
        id: SPACE_ID,
        organizationId: ORG_ID,
      })),
      fetchRuns: vi.fn(async () => []),
      fetchIncludedBases: vi.fn(async () => []),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 when spaceId is malformed', async () => {
    const res = await handleGet({
      account: makeAccount(),
      spaceId: 'not-a-uuid',
      limitParam: null,
      fetchSpaceById: vi.fn(async () => null),
      fetchRuns: vi.fn(async () => []),
      fetchIncludedBases: vi.fn(async () => []),
    })
    expect(res.status).toBe(400)
  })

  it('returns 403 when space is in a different org', async () => {
    const res = await handleGet({
      account: makeAccount(),
      spaceId: SPACE_ID,
      limitParam: null,
      fetchSpaceById: vi.fn(async () => ({
        id: SPACE_ID,
        organizationId: 'some-other-org',
      })),
      fetchRuns: vi.fn(async () => []),
      fetchIncludedBases: vi.fn(async () => []),
    })
    expect(res.status).toBe(403)
    expect(await readJson(res)).toEqual({ error: 'space_org_mismatch' })
  })

  it('returns 200 with mapped runs on the happy path', async () => {
    const res = await handleGet({
      account: makeAccount(),
      spaceId: SPACE_ID,
      limitParam: null,
      fetchSpaceById: vi.fn(async () => ({
        id: SPACE_ID,
        organizationId: ORG_ID,
      })),
      fetchRuns: vi.fn(async () => [r1]),
      fetchIncludedBases: vi.fn(async () => [{ id: 'b_1', name: 'CRM' }]),
    })
    expect(res.status).toBe(200)
    const body = await readJson(res)
    expect(body).toEqual({
      runs: [
        {
          id: 'r_1',
          status: 'succeeded',
          isTrial: false,
          triggeredBy: 'manual',
          recordCount: 100,
          tableCount: 2,
          attachmentCount: 0,
          startedAt: '2026-05-08T18:30:00.000Z',
          completedAt: '2026-05-08T18:31:00.000Z',
          errorMessage: null,
          triggerRunIds: ['run_a'],
          createdAt: '2026-05-08T18:30:00.000Z',
          connection: { id: 'conn_1', displayName: 'Main Airtable' },
          configuration: { storageType: 'r2_managed', mode: 'static' },
          includedBases: [{ id: 'b_1', name: 'CRM' }],
        },
      ],
    })
  })

  it('uses default limit 10 when ?limit is missing', async () => {
    const fetchRuns = vi.fn(async () => [])
    await handleGet({
      account: makeAccount(),
      spaceId: SPACE_ID,
      limitParam: null,
      fetchSpaceById: vi.fn(async () => ({
        id: SPACE_ID,
        organizationId: ORG_ID,
      })),
      fetchRuns,
      fetchIncludedBases: vi.fn(async () => []),
    })
    expect(fetchRuns).toHaveBeenCalledWith(SPACE_ID, 10)
  })

  it('respects ?limit when within bounds', async () => {
    const fetchRuns = vi.fn(async () => [])
    await handleGet({
      account: makeAccount(),
      spaceId: SPACE_ID,
      limitParam: '25',
      fetchSpaceById: vi.fn(async () => ({
        id: SPACE_ID,
        organizationId: ORG_ID,
      })),
      fetchRuns,
      fetchIncludedBases: vi.fn(async () => []),
    })
    expect(fetchRuns).toHaveBeenCalledWith(SPACE_ID, 25)
  })

  it('caps ?limit at 100', async () => {
    const fetchRuns = vi.fn(async () => [])
    await handleGet({
      account: makeAccount(),
      spaceId: SPACE_ID,
      limitParam: '500',
      fetchSpaceById: vi.fn(async () => ({
        id: SPACE_ID,
        organizationId: ORG_ID,
      })),
      fetchRuns,
      fetchIncludedBases: vi.fn(async () => []),
    })
    expect(fetchRuns).toHaveBeenCalledWith(SPACE_ID, 100)
  })

  it('falls back to default when ?limit is non-numeric', async () => {
    const fetchRuns = vi.fn(async () => [])
    await handleGet({
      account: makeAccount(),
      spaceId: SPACE_ID,
      limitParam: 'abc',
      fetchSpaceById: vi.fn(async () => ({
        id: SPACE_ID,
        organizationId: ORG_ID,
      })),
      fetchRuns,
      fetchIncludedBases: vi.fn(async () => []),
    })
    expect(fetchRuns).toHaveBeenCalledWith(SPACE_ID, 10)
  })
})

// ── statusForStartCode tests ─────────────────────────────────────────────

describe('statusForStartCode', () => {
  it.each([
    ['space_not_found', 403],
    ['space_org_mismatch', 403],
    ['no_active_connection', 422],
    ['no_bases_selected', 422],
    ['unsupported_storage_type', 422],
    ['run_not_found', 404],
    ['config_not_found', 404],
    ['connection_not_found', 404],
    ['run_already_started', 409],
    ['invalid_connection', 409],
    ['engine_unreachable', 503],
    ['engine_error', 502],
  ] as const)('maps %s → %i', (code, expected) => {
    expect(statusForStartCode(code)).toBe(expected)
  })
})
