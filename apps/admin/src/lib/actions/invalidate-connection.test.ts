import { describe, expect, it, vi } from 'vitest'
import { invalidateConnection, type InvalidateConnectionDeps } from './invalidate-connection'

function makeDeps(overrides: Partial<InvalidateConnectionDeps> = {}): InvalidateConnectionDeps {
  return {
    markConnectionInvalid: vi.fn(async () => {}),
    fetchActiveRunIdsForConnection: vi.fn(async () => ['run-1', 'run-2']),
    engineCancelRun: vi.fn(async () => ({ ok: true as const, cancelledTriggerRunIds: [] })),
    ...overrides,
  }
}

describe('invalidateConnection', () => {
  it('flips the status then cancels every in-flight run', async () => {
    const deps = makeDeps()

    const result = await invalidateConnection('conn-1', deps)

    expect(result).toEqual({
      ok: true,
      cancelledRuns: [
        { runId: 'run-1', ok: true },
        { runId: 'run-2', ok: true },
      ],
    })
    expect(deps.markConnectionInvalid).toHaveBeenCalledWith('conn-1')
    // status flip happens before any cancel attempt
    expect(vi.mocked(deps.markConnectionInvalid).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(deps.engineCancelRun!).mock.invocationCallOrder[0])
  })

  it('reports per-run cancel failures without rolling back the flip', async () => {
    const deps = makeDeps({
      engineCancelRun: vi.fn(async (runId: string) =>
        runId === 'run-1'
          ? { ok: true as const, cancelledTriggerRunIds: [] }
          : { ok: false as const, code: 'run_already_terminal' as const, status: 409 },
      ),
    })

    const result = await invalidateConnection('conn-1', deps)

    expect(result).toEqual({
      ok: true,
      cancelledRuns: [
        { runId: 'run-1', ok: true },
        { runId: 'run-2', ok: false, code: 'run_already_terminal' },
      ],
    })
  })

  it('skips cancels when no engine client is available', async () => {
    const deps = makeDeps({ engineCancelRun: null })

    const result = await invalidateConnection('conn-1', deps)

    expect(result).toEqual({ ok: true, cancelledRuns: 'skipped_no_engine' })
    expect(deps.markConnectionInvalid).toHaveBeenCalledWith('conn-1')
    expect(deps.fetchActiveRunIdsForConnection).not.toHaveBeenCalled()
  })

  it('returns no cancelled runs when nothing is in flight', async () => {
    const deps = makeDeps({ fetchActiveRunIdsForConnection: vi.fn(async () => []) })

    expect(await invalidateConnection('conn-1', deps)).toEqual({ ok: true, cancelledRuns: [] })
  })

  it('treats an engine throw as a per-run failure, not an action failure', async () => {
    const deps = makeDeps({
      fetchActiveRunIdsForConnection: vi.fn(async () => ['run-1']),
      engineCancelRun: vi.fn(async () => { throw new Error('network') }),
    })

    expect(await invalidateConnection('conn-1', deps)).toEqual({
      ok: true,
      cancelledRuns: [{ runId: 'run-1', ok: false, code: 'engine_unreachable' }],
    })
  })
})
