// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  $backupRuns,
  setRuns,
  startPolling,
  stopPolling,
} from '../../stores/backup-runs'
import type { BackupRunSummary } from '../backup-runs/types'
import { registerBackupHistoryLifecycle } from './widget-lifecycle'

/**
 * Pinning the Astro 5 ClientRouter lifecycle for BackupHistoryWidget.
 *
 * Before this lifecycle wiring landed, the widget's <script> ran setup at
 * module top — exactly once per browser session under ClientRouter. After
 * any in-app navigation the chip stopped flipping because subscribe +
 * startPolling never re-fired. These tests pin the page-load → setup /
 * before-swap → teardown contract so the regression can't come back.
 */

const SPACE_ID = '11111111-1111-1111-1111-111111111111'

function seedDom(spaceId: string = SPACE_ID): void {
  document.body.innerHTML = `
    <section data-backup-history data-space-id="${spaceId}"></section>
    <script type="application/json" data-backup-history-state>[]</script>
  `
}

function summary(overrides: Partial<BackupRunSummary> = {}): BackupRunSummary {
  return {
    id: 'r_test',
    status: 'running',
    isTrial: false,
    triggeredBy: 'manual',
    recordCount: null,
    tableCount: null,
    attachmentCount: null,
    startedAt: '2026-05-12T10:00:00.000Z',
    completedAt: null,
    errorMessage: null,
    triggerRunIds: null,
    createdAt: '2026-05-12T10:00:00.000Z',
    connection: null,
    configuration: null,
    includedBases: [],
    ...overrides,
  }
}

describe('registerBackupHistoryLifecycle', () => {
  let unregister: (() => void) | null = null

  beforeEach(() => {
    seedDom()
    setRuns([])
    // Cancel any polling that survived a prior test's teardown.
    stopPolling()
  })

  afterEach(() => {
    if (unregister) {
      unregister()
      unregister = null
    }
    stopPolling()
    document.body.innerHTML = ''
  })

  it('dispatching astro:page-load subscribes + starts polling for the widget spaceId', async () => {
    const render = vi.fn()
    const fetchRuns = vi.fn(async () => [] as BackupRunSummary[])

    unregister = registerBackupHistoryLifecycle({ render, fetchRuns })
    document.dispatchEvent(new CustomEvent('astro:page-load'))

    // subscribe wires render to the store — initial value (empty array) is
    // delivered synchronously per nanostores semantics.
    expect(render).toHaveBeenCalledWith([])

    // backup-run-started should be live now — dispatching it should flush a
    // refresh through the injected fetchRuns.
    window.dispatchEvent(new CustomEvent('backup-run-started'))
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchRuns).toHaveBeenCalledWith(SPACE_ID)
  })

  it('dispatching astro:before-swap unsubscribes + stops polling + removes window listener', async () => {
    const render = vi.fn()
    const fetchRuns = vi.fn(async () => [] as BackupRunSummary[])

    unregister = registerBackupHistoryLifecycle({ render, fetchRuns })
    document.dispatchEvent(new CustomEvent('astro:page-load'))
    render.mockClear()
    fetchRuns.mockClear()

    document.dispatchEvent(new CustomEvent('astro:before-swap'))

    // After teardown:
    //   - render is no longer subscribed → setRuns does NOT re-invoke it.
    setRuns([summary({ id: 'r_after_teardown' })])
    expect(render).not.toHaveBeenCalled()

    //   - backup-run-started listener was removed → fetchRuns does NOT fire.
    window.dispatchEvent(new CustomEvent('backup-run-started'))
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchRuns).not.toHaveBeenCalled()
  })

  it('two page-loads in a row mount cleanly without double-subscribing', () => {
    const render = vi.fn()
    const fetchRuns = vi.fn(async () => [] as BackupRunSummary[])

    unregister = registerBackupHistoryLifecycle({ render, fetchRuns })

    // First mount: page-load → setup.
    document.dispatchEvent(new CustomEvent('astro:page-load'))
    // Second page-load WITHOUT an intervening before-swap exercises the
    // safety teardown inside the page-load handler.
    document.dispatchEvent(new CustomEvent('astro:page-load'))

    render.mockClear()

    // Trigger one store update — only ONE subscriber should fire (the most
    // recent setup). If the prior setup leaked, render would fire twice.
    setRuns([summary({ id: 'r_leak_check' })])
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('no-ops when the widget is absent from the page (predicate fails)', () => {
    document.body.innerHTML = '' // no [data-backup-history] root
    const render = vi.fn()
    const fetchRuns = vi.fn(async () => [] as BackupRunSummary[])

    unregister = registerBackupHistoryLifecycle({ render, fetchRuns })
    document.dispatchEvent(new CustomEvent('astro:page-load'))

    // No subscribe, no polling, no listener — render is never called.
    expect(render).not.toHaveBeenCalled()
    // before-swap on a never-mounted widget is also safe.
    expect(() =>
      document.dispatchEvent(new CustomEvent('astro:before-swap')),
    ).not.toThrow()
  })

  it('backup-run-started re-arms polling after the loop self-suspends on all-terminal', async () => {
    // The poll loop self-suspends as soon as every run in the store is
    // terminal (see backup-runs.ts:tick). Without an explicit re-arm,
    // clicking "Run backup now" produces ONE immediate fetch (from the
    // listener) and then silence — the chip never flips because no
    // further fetches go out. Pin the regression: the listener must
    // restart polling so the loop resumes.
    vi.useFakeTimers()
    try {
      const render = vi.fn()
      let call = 0
      const fetchRuns = vi.fn(async (): Promise<BackupRunSummary[]> => {
        call += 1
        // Initial poll tick: empty → allTerminal=true → stopPolling.
        if (call === 1) return []
        // Listener refresh + subsequent poll ticks: non-terminal row.
        return [summary({ id: 'r_new', status: 'running' })]
      })

      unregister = registerBackupHistoryLifecycle({ render, fetchRuns })
      document.dispatchEvent(new CustomEvent('astro:page-load'))

      // First poll tick fires at +2s. allTerminal on [] suspends polling.
      await vi.advanceTimersByTimeAsync(2_500)
      expect(fetchRuns).toHaveBeenCalledTimes(1)

      // Confirm the loop really did suspend: another 5s of fake clock
      // produces no further ticks.
      await vi.advanceTimersByTimeAsync(5_000)
      expect(fetchRuns).toHaveBeenCalledTimes(1)

      // User clicks Run backup now. Listener fires immediate refresh
      // (call #2). Without the re-arm, the count stops here forever.
      window.dispatchEvent(new CustomEvent('backup-run-started'))
      // Drain microtasks so the async handler completes (await fetchRuns
      // → setRuns → startPolling).
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      expect(fetchRuns).toHaveBeenCalledTimes(2)

      // With the fix: startPolling was called inside the listener,
      // scheduling a +2s tick. Advance past it and expect a third call.
      await vi.advanceTimersByTimeAsync(2_500)
      expect(fetchRuns.mock.calls.length).toBeGreaterThanOrEqual(3)
    } finally {
      vi.useRealTimers()
    }
  })
})
