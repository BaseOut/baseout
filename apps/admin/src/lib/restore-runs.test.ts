import { describe, expect, it } from 'vitest'
import {
  summarizeRestores,
  filterByStatus,
  describeScope,
  type RestoreRow,
} from './restore-runs'

const NOW = new Date('2026-07-17T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000)

function row(overrides: Partial<RestoreRow> = {}): RestoreRow {
  return {
    id: 'r1',
    status: 'succeeded',
    scope: 'base',
    scopeTarget: { baseId: 'appX' },
    tablesRestored: 3,
    recordsRestored: 100,
    attachmentsRestored: 0,
    triggeredBy: 'user_manual',
    isTrial: false,
    startedAt: hoursAgo(2),
    completedAt: hoursAgo(1),
    errorMessage: null,
    createdAt: hoursAgo(2),
    spaceName: 'prod',
    orgName: 'Acme',
    ...overrides,
  }
}

describe('summarizeRestores', () => {
  it('buckets into 24h and 7d windows with status counts', () => {
    const rows = [
      row(),                                              // succeeded, 2h ago
      row({ id: 'r2', status: 'failed', createdAt: hoursAgo(30) }),   // 7d only
      row({ id: 'r3', status: 'running', createdAt: hoursAgo(1) }),
      row({ id: 'r4', createdAt: hoursAgo(24 * 10) }),    // outside both
    ]
    const [day, week] = summarizeRestores(rows, NOW)
    expect(day).toMatchObject({ window: '24h', total: 2, succeeded: 1, failed: 0, active: 1 })
    expect(week).toMatchObject({ window: '7d', total: 3, failed: 1 })
  })
})

describe('filterByStatus', () => {
  it('passes through with no filter and filters exactly otherwise', () => {
    const rows = [row(), row({ id: 'r2', status: 'failed' })]
    expect(filterByStatus(rows, null)).toHaveLength(2)
    expect(filterByStatus(rows, 'failed')).toHaveLength(1)
    expect(filterByStatus(rows, 'cancelled')).toHaveLength(0)
  })
})

describe('describeScope', () => {
  it('describes base, table, and point-in-time scopes', () => {
    expect(describeScope('base', { baseId: 'appX' })).toBe('base appX')
    expect(describeScope('table', { baseId: 'appX', tableId: 'tblY' })).toBe('table appX/tblY')
    expect(describeScope('point_in_time', { runId: 'run1' })).toBe('point-in-time')
  })

  it('degrades gracefully on missing/malformed targets', () => {
    expect(describeScope('base', null)).toBe('base')
    expect(describeScope('table', { tableId: 'tblY' })).toBe('table tblY')
    expect(describeScope('table', {})).toBe('table')
    expect(describeScope('mystery', {})).toBe('mystery')
    expect(describeScope('base', { baseId: 42 })).toBe('base')
  })
})
