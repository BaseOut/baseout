import { describe, it, expect } from 'vitest'
import { summarizeRuns, filterByStatus, formatDuration, type RunRow } from './backup-runs'

const NOW = new Date('2026-07-13T12:00:00Z')

function run(overrides: Partial<RunRow>): RunRow {
  return {
    id: 'r1',
    status: 'succeeded',
    kind: 'full',
    isTrial: false,
    triggeredBy: 'manual',
    recordCount: 10,
    tableCount: 2,
    attachmentCount: 0,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    deletedAt: null,
    createdAt: NOW,
    spaceName: 'Space',
    orgName: 'Org',
    ...overrides,
  }
}

const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000)

describe('summarizeRuns', () => {
  it('buckets runs into 24h and 7d windows', () => {
    const runs = [
      run({ createdAt: hoursAgo(1), status: 'succeeded' }),
      run({ createdAt: hoursAgo(30), status: 'failed' }), // 7d only
      run({ createdAt: hoursAgo(24 * 8), status: 'failed' }), // outside both
      run({ createdAt: hoursAgo(2), status: 'running' }),
    ]
    const [day, week] = summarizeRuns(runs, NOW)
    expect(day).toEqual({ window: '24h', total: 2, succeeded: 1, failed: 0, active: 1 })
    expect(week).toEqual({ window: '7d', total: 3, succeeded: 1, failed: 1, active: 1 })
  })

  it('counts trial completions as successes and queued/cancelling as active', () => {
    const runs = [
      run({ createdAt: hoursAgo(1), status: 'trial_complete' }),
      run({ createdAt: hoursAgo(1), status: 'queued' }),
      run({ createdAt: hoursAgo(1), status: 'cancelling' }),
    ]
    const [day] = summarizeRuns(runs, NOW)
    expect(day.succeeded).toBe(1)
    expect(day.active).toBe(2)
  })

  it('handles no runs', () => {
    const [day, week] = summarizeRuns([], NOW)
    expect(day.total).toBe(0)
    expect(week.total).toBe(0)
  })
})

describe('filterByStatus', () => {
  const runs = [run({ status: 'failed' }), run({ status: 'succeeded' })]

  it('passes everything through with no filter', () => {
    expect(filterByStatus(runs, null)).toHaveLength(2)
  })

  it('filters to the requested status', () => {
    expect(filterByStatus(runs, 'failed').map((r) => r.status)).toEqual(['failed'])
  })

  it('matches nothing for an unknown status', () => {
    expect(filterByStatus(runs, 'bogus')).toHaveLength(0)
  })
})

describe('formatDuration', () => {
  it('formats sub-minute and minute+ durations', () => {
    expect(formatDuration(NOW, new Date(NOW.getTime() + 42_000))).toBe('42s')
    expect(formatDuration(NOW, new Date(NOW.getTime() + 95_000))).toBe('1m 35s')
  })

  it('returns a dash for missing or inverted timestamps', () => {
    expect(formatDuration(null, NOW)).toBe('—')
    expect(formatDuration(NOW, null)).toBe('—')
    expect(formatDuration(NOW, new Date(NOW.getTime() - 1000))).toBe('—')
  })
})
