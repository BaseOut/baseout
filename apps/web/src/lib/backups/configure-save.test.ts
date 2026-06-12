import { describe, expect, it, vi } from 'vitest'
import { saveConfigureForm } from './configure-save'
import type { SaveConfigResult } from './save-config'
import type { RunBackupResult } from './run-backup'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'

const okSave = vi.fn(async (): Promise<SaveConfigResult> => ({ ok: true }))
const okRun = vi.fn(
  async (): Promise<RunBackupResult> => ({ ok: true, runId: 'r1', triggerRunIds: ['t1'] }),
)

describe('saveConfigureForm', () => {
  it('saves frequency then redirects to ?status=saved on edit', async () => {
    const saveConfigImpl = vi.fn(async (): Promise<SaveConfigResult> => ({ ok: true }))
    const result = await saveConfigureForm(
      { spaceId: SPACE_ID, frequency: 'weekly', runFirstBackup: false },
      { saveConfigImpl, runBackupImpl: okRun },
    )
    expect(saveConfigImpl).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      frequency: 'weekly',
    })
    expect(result).toEqual({ ok: true, redirect: '/integrations?status=saved' })
  })

  it('skips the PATCH when no frequency is provided', async () => {
    const saveConfigImpl = vi.fn(async (): Promise<SaveConfigResult> => ({ ok: true }))
    const result = await saveConfigureForm(
      { spaceId: SPACE_ID, runFirstBackup: false },
      { saveConfigImpl, runBackupImpl: okRun },
    )
    expect(saveConfigImpl).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true, redirect: '/integrations?status=saved' })
  })

  it('runs the first backup and redirects to ?status=running on first setup', async () => {
    const runBackupImpl = vi.fn(
      async (): Promise<RunBackupResult> => ({ ok: true, runId: 'r1', triggerRunIds: ['t1'] }),
    )
    const result = await saveConfigureForm(
      { spaceId: SPACE_ID, frequency: 'monthly', runFirstBackup: true },
      { saveConfigImpl: okSave, runBackupImpl },
    )
    expect(runBackupImpl).toHaveBeenCalledWith(SPACE_ID)
    expect(result).toEqual({
      ok: true,
      redirect: '/integrations?status=running',
    })
  })

  it('returns the save error and does NOT run a backup when the PATCH fails', async () => {
    const saveConfigImpl = vi.fn(
      async (): Promise<SaveConfigResult> =>
        ({ ok: false, error: 'frequency_not_allowed', status: 422 }),
    )
    const runBackupImpl = vi.fn(
      async (): Promise<RunBackupResult> => ({ ok: true, runId: 'r1', triggerRunIds: [] }),
    )
    const result = await saveConfigureForm(
      { spaceId: SPACE_ID, frequency: 'instant', runFirstBackup: true },
      { saveConfigImpl, runBackupImpl },
    )
    expect(runBackupImpl).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      message: 'That schedule is not available on your plan.',
    })
  })

  it('surfaces the run error when the first backup fails to start', async () => {
    const runBackupImpl = vi.fn(
      async (): Promise<RunBackupResult> =>
        ({ ok: false, error: 'no_bases_selected', status: 422 }),
    )
    const result = await saveConfigureForm(
      { spaceId: SPACE_ID, frequency: 'monthly', runFirstBackup: true },
      { saveConfigImpl: okSave, runBackupImpl },
    )
    expect(result).toEqual({
      ok: false,
      message: 'Select at least one base before running a backup.',
    })
  })
})
