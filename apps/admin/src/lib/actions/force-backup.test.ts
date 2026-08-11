import { describe, expect, it, vi } from 'vitest'
import { forceBackup, type ForceBackupDeps } from './force-backup'

const space = { id: 'space-1', organizationId: 'org-1' }

function makeDeps(overrides: Partial<ForceBackupDeps> = {}): ForceBackupDeps {
  return {
    fetchAirtableConnection: vi.fn(async () => ({ id: 'conn-1', status: 'active' })),
    countIncludedBases: vi.fn(async () => 2),
    insertBackupRun: vi.fn(async () => 'run-1'),
    deleteBackupRun: vi.fn(async () => {}),
    engineStartRun: vi.fn(async () => ({
      ok: true as const,
      runId: 'run-1',
      triggerRunIds: ['tr_1'],
    })),
    ...overrides,
  }
}

describe('forceBackup', () => {
  it('queues a run and starts the engine fan-out', async () => {
    const deps = makeDeps()

    const result = await forceBackup(space, deps)

    expect(result).toEqual({ ok: true, runId: 'run-1', triggerRunIds: ['tr_1'] })
    expect(deps.fetchAirtableConnection).toHaveBeenCalledWith('org-1')
    expect(deps.insertBackupRun).toHaveBeenCalledWith({
      spaceId: 'space-1',
      connectionId: 'conn-1',
      isTrial: false,
    })
    expect(deps.deleteBackupRun).not.toHaveBeenCalled()
  })

  it('rejects when the org has no Airtable connection', async () => {
    const deps = makeDeps({ fetchAirtableConnection: vi.fn(async () => null) })

    expect(await forceBackup(space, deps)).toEqual({ ok: false, code: 'no_active_connection' })
    expect(deps.insertBackupRun).not.toHaveBeenCalled()
  })

  it('rejects when the connection is not active', async () => {
    const deps = makeDeps({
      fetchAirtableConnection: vi.fn(async () => ({ id: 'conn-1', status: 'invalid' })),
    })

    expect(await forceBackup(space, deps)).toEqual({ ok: false, code: 'invalid_connection' })
  })

  it('rejects when no bases are included', async () => {
    const deps = makeDeps({ countIncludedBases: vi.fn(async () => 0) })

    expect(await forceBackup(space, deps)).toEqual({ ok: false, code: 'no_bases_selected' })
    expect(deps.insertBackupRun).not.toHaveBeenCalled()
  })

  it('deletes the orphan run row when the engine rejects', async () => {
    const deps = makeDeps({
      engineStartRun: vi.fn(async () => ({
        ok: false as const,
        code: 'config_not_found' as const,
        status: 404,
      })),
    })

    const result = await forceBackup(space, deps)

    expect(result).toEqual({ ok: false, code: 'config_not_found', status: 404 })
    expect(deps.deleteBackupRun).toHaveBeenCalledWith('run-1')
  })

  it('surfaces the engine error even when the orphan delete fails', async () => {
    const deps = makeDeps({
      engineStartRun: vi.fn(async () => ({
        ok: false as const,
        code: 'engine_unreachable' as const,
        status: 0,
      })),
      deleteBackupRun: vi.fn(async () => { throw new Error('db blip') }),
    })

    expect(await forceBackup(space, deps)).toEqual({
      ok: false,
      code: 'engine_unreachable',
      status: 0,
    })
  })
})
