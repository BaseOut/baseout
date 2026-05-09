/**
 * Pure-function tests for the apps/web run-start orchestration (Phase 9).
 *
 * Mirrors the @baseout/server processRunStart test pattern (see
 * apps/server/tests/integration/runs-start.test.ts): inject every side-
 * effect (DB queries + engine call) as a vi.fn() dep so paths are unit-
 * testable without touching Postgres or the engine binding. Routing
 * tests live in src/pages/api/spaces/[spaceId]/backup-runs.test.ts.
 */

import { describe, expect, it, vi } from 'vitest'
import { startBackupRun } from './start'
import type { StartBackupRunDeps, SpaceRow, ConnectionRow } from './start'
import type { EngineStartRunResult } from '../backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'
const OTHER_ORG_ID = '33333333-3333-3333-3333-333333333333'
const CONNECTION_ID = '44444444-4444-4444-4444-444444444444'
const RUN_ID = '55555555-5555-5555-5555-555555555555'

function makeSpace(overrides: Partial<SpaceRow> = {}): SpaceRow {
  return { id: SPACE_ID, organizationId: ORG_ID, ...overrides }
}

function makeConnection(overrides: Partial<ConnectionRow> = {}): ConnectionRow {
  return {
    id: CONNECTION_ID,
    organizationId: ORG_ID,
    status: 'active',
    ...overrides,
  }
}

function makeDeps(overrides: Partial<StartBackupRunDeps> = {}): StartBackupRunDeps {
  return {
    fetchSpaceById: vi.fn(async () => makeSpace()),
    fetchAirtableConnection: vi.fn(async () => makeConnection()),
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

describe('startBackupRun', () => {
  it('happy: INSERTs run, calls engine.startRun, returns runId + triggerRunIds', async () => {
    const deps = makeDeps()
    const result = await startBackupRun(
      { spaceId: SPACE_ID, organizationId: ORG_ID },
      deps,
    )

    expect(result).toEqual({
      ok: true,
      runId: RUN_ID,
      triggerRunIds: ['run_a', 'run_b'],
    })
    expect(deps.insertBackupRun).toHaveBeenCalledOnce()
    expect(deps.insertBackupRun).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      connectionId: CONNECTION_ID,
      isTrial: false,
    })
    expect(deps.engineStartRun).toHaveBeenCalledWith(RUN_ID)
    expect(deps.deleteBackupRun).not.toHaveBeenCalled()
  })

  it('returns space_not_found when no row exists; no INSERT', async () => {
    const deps = makeDeps({
      fetchSpaceById: vi.fn(async () => null),
    })
    const result = await startBackupRun(
      { spaceId: SPACE_ID, organizationId: ORG_ID },
      deps,
    )

    expect(result).toEqual({ ok: false, code: 'space_not_found' })
    expect(deps.insertBackupRun).not.toHaveBeenCalled()
    expect(deps.engineStartRun).not.toHaveBeenCalled()
  })

  it('returns space_org_mismatch when the row belongs to a different org; no INSERT', async () => {
    const deps = makeDeps({
      fetchSpaceById: vi.fn(async () => makeSpace({ organizationId: OTHER_ORG_ID })),
    })
    const result = await startBackupRun(
      { spaceId: SPACE_ID, organizationId: ORG_ID },
      deps,
    )

    expect(result).toEqual({ ok: false, code: 'space_org_mismatch' })
    expect(deps.insertBackupRun).not.toHaveBeenCalled()
    expect(deps.engineStartRun).not.toHaveBeenCalled()
  })

  it('returns no_active_connection when no Airtable connection exists; no INSERT', async () => {
    const deps = makeDeps({
      fetchAirtableConnection: vi.fn(async () => null),
    })
    const result = await startBackupRun(
      { spaceId: SPACE_ID, organizationId: ORG_ID },
      deps,
    )

    expect(result).toEqual({ ok: false, code: 'no_active_connection' })
    expect(deps.insertBackupRun).not.toHaveBeenCalled()
    expect(deps.engineStartRun).not.toHaveBeenCalled()
  })

  it('returns invalid_connection when the Airtable connection is not active; no INSERT', async () => {
    const deps = makeDeps({
      fetchAirtableConnection: vi.fn(async () => makeConnection({ status: 'pending_reauth' })),
    })
    const result = await startBackupRun(
      { spaceId: SPACE_ID, organizationId: ORG_ID },
      deps,
    )

    expect(result).toEqual({ ok: false, code: 'invalid_connection' })
    expect(deps.insertBackupRun).not.toHaveBeenCalled()
    expect(deps.engineStartRun).not.toHaveBeenCalled()
  })

  it('returns no_bases_selected when zero bases are included; no INSERT', async () => {
    const deps = makeDeps({
      countIncludedBases: vi.fn(async () => 0),
    })
    const result = await startBackupRun(
      { spaceId: SPACE_ID, organizationId: ORG_ID },
      deps,
    )

    expect(result).toEqual({ ok: false, code: 'no_bases_selected' })
    expect(deps.insertBackupRun).not.toHaveBeenCalled()
    expect(deps.engineStartRun).not.toHaveBeenCalled()
  })

  it('rolls back the orphaned run when engine returns a 4xx', async () => {
    const deps = makeDeps({
      engineStartRun: vi.fn(
        async (): Promise<EngineStartRunResult> => ({
          ok: false,
          code: 'run_already_started',
          status: 409,
        }),
      ),
    })
    const result = await startBackupRun(
      { spaceId: SPACE_ID, organizationId: ORG_ID },
      deps,
    )

    expect(result).toEqual({
      ok: false,
      code: 'run_already_started',
      status: 409,
    })
    expect(deps.insertBackupRun).toHaveBeenCalledOnce()
    expect(deps.deleteBackupRun).toHaveBeenCalledWith(RUN_ID)
  })

  it('rolls back the orphaned run when engine is unreachable', async () => {
    const deps = makeDeps({
      engineStartRun: vi.fn(
        async (): Promise<EngineStartRunResult> => ({
          ok: false,
          code: 'engine_unreachable',
          status: 0,
        }),
      ),
    })
    const result = await startBackupRun(
      { spaceId: SPACE_ID, organizationId: ORG_ID },
      deps,
    )

    expect(result).toEqual({
      ok: false,
      code: 'engine_unreachable',
      status: 0,
    })
    expect(deps.deleteBackupRun).toHaveBeenCalledWith(RUN_ID)
  })

  it('rolls back the orphaned run when engine returns engine_error', async () => {
    const deps = makeDeps({
      engineStartRun: vi.fn(
        async (): Promise<EngineStartRunResult> => ({
          ok: false,
          code: 'engine_error',
          status: 502,
        }),
      ),
    })
    const result = await startBackupRun(
      { spaceId: SPACE_ID, organizationId: ORG_ID },
      deps,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('engine_error')
    expect(deps.deleteBackupRun).toHaveBeenCalledWith(RUN_ID)
  })

  it('does NOT swallow rollback errors silently — caller surfaces engine error to user', async () => {
    // If deleteBackupRun throws (e.g. master DB transient error), we still
    // surface the engine error to the caller. The orphaned 'queued' row
    // can be cleaned up by an out-of-band sweeper later. Surfacing the DB
    // error instead would mask the real problem (the engine's 4xx).
    const deps = makeDeps({
      engineStartRun: vi.fn(
        async (): Promise<EngineStartRunResult> => ({
          ok: false,
          code: 'invalid_connection',
          status: 409,
        }),
      ),
      deleteBackupRun: vi.fn(async () => {
        throw new Error('connection lost')
      }),
    })
    const result = await startBackupRun(
      { spaceId: SPACE_ID, organizationId: ORG_ID },
      deps,
    )

    expect(result).toEqual({
      ok: false,
      code: 'invalid_connection',
      status: 409,
    })
  })
})
