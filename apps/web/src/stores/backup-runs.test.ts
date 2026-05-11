/**
 * Tests for the $backupRuns nanostore + its polling controller.
 *
 * Polling rule: while any run is non-terminal (queued / running),
 * re-fetch every 10 seconds. Terminal statuses are 'succeeded',
 * 'failed', 'trial_complete', 'trial_truncated'.
 *
 * Uses vi.useFakeTimers() to drive the interval deterministically.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  $backupRuns,
  isTerminalStatus,
  setRuns,
  startPolling,
  stopPolling,
} from './backup-runs'
import type { BackupRunSummary } from '../lib/backup-runs/types'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'

function makeRun(overrides: Partial<BackupRunSummary> = {}): BackupRunSummary {
  return {
    id: 'r_1',
    status: 'running',
    isTrial: false,
    recordCount: null,
    tableCount: null,
    attachmentCount: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    triggerRunIds: null,
    createdAt: '2026-05-08T18:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  $backupRuns.set([])
})
afterEach(() => {
  stopPolling()
  vi.useRealTimers()
})

describe('isTerminalStatus', () => {
  it.each([
    ['succeeded', true],
    ['failed', true],
    ['trial_complete', true],
    ['trial_truncated', true],
    ['queued', false],
    ['running', false],
    ['something_unknown', false],
  ] as const)('isTerminalStatus(%s) → %s', (status, expected) => {
    expect(isTerminalStatus(status)).toBe(expected)
  })
})

describe('setRuns', () => {
  it('updates the atom value', () => {
    const r = makeRun({ id: 'r_x', status: 'succeeded' })
    setRuns([r])
    expect($backupRuns.get()).toEqual([r])
  })
})

describe('polling', () => {
  it('does not call fetchFn before the first interval elapses', async () => {
    const fetchFn = vi.fn(async () => [makeRun()])
    startPolling(SPACE_ID, fetchFn)
    // No timers fired yet — no fetches.
    expect(fetchFn).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(9_999)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('calls fetchFn at t+10s and then every 10s while non-terminal', async () => {
    const fetchFn = vi.fn(async () => [makeRun({ status: 'running' })])
    startPolling(SPACE_ID, fetchFn)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('stops polling once all runs are terminal', async () => {
    let call = 0
    const fetchFn = vi.fn(async () => {
      call++
      if (call === 1) return [makeRun({ status: 'running' })]
      return [makeRun({ status: 'succeeded' })]
    })
    startPolling(SPACE_ID, fetchFn)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    // All runs terminal — further ticks should NOT trigger fetches.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('stops polling when first poll already returns terminal runs', async () => {
    const fetchFn = vi.fn(async () => [makeRun({ status: 'succeeded' })])
    startPolling(SPACE_ID, fetchFn)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('stopPolling clears the timer', async () => {
    const fetchFn = vi.fn(async () => [makeRun({ status: 'running' })])
    startPolling(SPACE_ID, fetchFn)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    stopPolling()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('starting a new poll replaces the previous timer', async () => {
    const f1 = vi.fn(async () => [makeRun({ status: 'running' })])
    const f2 = vi.fn(async () => [makeRun({ status: 'running' })])
    startPolling(SPACE_ID, f1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(f1).toHaveBeenCalledTimes(1)

    // Replace before the next tick fires.
    startPolling(SPACE_ID, f2)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(f1).toHaveBeenCalledTimes(1) // never re-called
    expect(f2).toHaveBeenCalledTimes(1)
  })

  it('updates $backupRuns with each fetched batch', async () => {
    const r1 = makeRun({ id: 'r_a', status: 'running' })
    const r2 = makeRun({ id: 'r_a', status: 'succeeded' })
    let n = 0
    const fetchFn = vi.fn(async () => {
      n++
      return n === 1 ? [r1] : [r2]
    })
    startPolling(SPACE_ID, fetchFn)
    await vi.advanceTimersByTimeAsync(10_000)
    expect($backupRuns.get()).toEqual([r1])

    await vi.advanceTimersByTimeAsync(10_000)
    expect($backupRuns.get()).toEqual([r2])
  })
})
