import { describe, expect, it, vi } from 'vitest'
import { createHomeLiveRender, recordCountDelta, runsSignature } from './home-live'
import type { BackupRunSummary } from '../backup-runs/types'

function run(id: string, status: BackupRunSummary['status']): BackupRunSummary {
  return {
    id,
    status,
    kind: 'full',
    isTrial: false,
    triggeredBy: 'manual',
    recordCount: 0,
    tableCount: 0,
    attachmentCount: 0,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    triggerRunIds: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    connection: null,
    configuration: null,
    includedBases: [],
  }
}

describe('runsSignature', () => {
  it('is stable across non-status field changes', () => {
    const a = run('r1', 'running')
    const b = { ...a, recordCount: 500, attachmentCount: 3 }
    expect(runsSignature([a])).toBe(runsSignature([b]))
  })

  it('changes when a run status transitions', () => {
    expect(runsSignature([run('r1', 'running')])).not.toBe(
      runsSignature([run('r1', 'succeeded')]),
    )
  })

  it('changes when a new run appears', () => {
    expect(runsSignature([run('r1', 'succeeded')])).not.toBe(
      runsSignature([run('r2', 'queued'), run('r1', 'succeeded')]),
    )
  })
})

describe('createHomeLiveRender', () => {
  it('does not reload on the first (hydration) render', () => {
    const reload = vi.fn()
    const render = createHomeLiveRender(reload)
    render([run('r1', 'succeeded')])
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload when polls return the same state', () => {
    const reload = vi.fn()
    const render = createHomeLiveRender(reload)
    render([run('r1', 'running')])
    render([{ ...run('r1', 'running'), recordCount: 900 }])
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once when a run reaches a terminal status', () => {
    const reload = vi.fn()
    const render = createHomeLiveRender(reload)
    render([run('r1', 'running')])
    render([run('r1', 'succeeded')])
    expect(reload).toHaveBeenCalledTimes(1)
    // Store re-emits the same terminal state — no reload loop.
    render([run('r1', 'succeeded')])
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads when a new run appears after hydration', () => {
    const reload = vi.fn()
    const render = createHomeLiveRender(reload)
    render([])
    render([run('r1', 'queued')])
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('recordCountDelta', () => {
  it('treats a flat zero as neither up nor down', () => {
    expect(recordCountDelta(0)).toEqual({ dir: 'flat', amount: 0 })
    expect(recordCountDelta(12, 12)).toEqual({ dir: 'flat', amount: 0 })
  })

  it('is up only when the count actually grew', () => {
    expect(recordCountDelta(10)).toEqual({ dir: 'up', amount: 10 })
  })

  it('is down when the count fell', () => {
    expect(recordCountDelta(-4)).toEqual({ dir: 'down', amount: 4 })
  })
})
