import { describe, expect, it } from 'vitest'
import {
  describeCounts,
  expandedTimestamp,
  formatDuration,
  formatTriggeredBy,
  healthBadgeClass,
  healthStatus,
  statusBadgeClass,
  statusLabel,
} from './format'
import type { BackupRunSummary } from '../backup-runs/types'

function run(overrides: Partial<BackupRunSummary> = {}): BackupRunSummary {
  return {
    id: 'r_1',
    status: 'queued',
    isTrial: false,
    triggeredBy: 'manual',
    recordCount: null,
    tableCount: null,
    attachmentCount: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    triggerRunIds: null,
    createdAt: '2026-05-09T00:00:00.000Z',
    connection: null,
    configuration: null,
    includedBases: [],
    ...overrides,
  }
}

describe('statusLabel', () => {
  it.each([
    ['queued', 'Queued'],
    ['running', 'Running'],
    ['succeeded', 'Succeeded'],
    ['failed', 'Failed'],
    ['trial_complete', 'Trial complete'],
    ['trial_truncated', 'Trial — truncated'],
  ])('%s → %s', (s, expected) => {
    expect(statusLabel(s)).toBe(expected)
  })

  it('falls back to the raw status for unknown values', () => {
    expect(statusLabel('something_else')).toBe('something_else')
  })
})

describe('statusBadgeClass', () => {
  it.each([
    ['succeeded', 'badge-success'],
    ['failed', 'badge-error'],
    ['running', 'badge-info'],
    ['queued', 'badge-ghost'],
    ['trial_complete', 'badge-warning'],
    ['trial_truncated', 'badge-warning'],
  ])('%s → %s', (s, expected) => {
    expect(statusBadgeClass(s)).toBe(expected)
  })

  it('falls back to badge-ghost for unknown values', () => {
    expect(statusBadgeClass('something_else')).toBe('badge-ghost')
  })
})

describe('formatDuration', () => {
  it('returns null when either bound is missing', () => {
    expect(formatDuration(null, '2026-05-09T00:00:00.000Z')).toBeNull()
    expect(formatDuration('2026-05-09T00:00:00.000Z', null)).toBeNull()
    expect(formatDuration(null, null)).toBeNull()
  })

  it('returns Xs for sub-minute durations', () => {
    expect(
      formatDuration(
        '2026-05-09T00:00:00.000Z',
        '2026-05-09T00:00:42.000Z',
      ),
    ).toBe('42s')
  })

  it('returns Xm Ys for sub-hour durations', () => {
    expect(
      formatDuration(
        '2026-05-09T00:00:00.000Z',
        '2026-05-09T00:03:15.000Z',
      ),
    ).toBe('3m 15s')
  })

  it('drops the seconds when the minute boundary is exact', () => {
    expect(
      formatDuration(
        '2026-05-09T00:00:00.000Z',
        '2026-05-09T00:05:00.000Z',
      ),
    ).toBe('5m')
  })

  it('returns Xh Ym for multi-hour durations', () => {
    expect(
      formatDuration(
        '2026-05-09T00:00:00.000Z',
        '2026-05-09T02:30:00.000Z',
      ),
    ).toBe('2h 30m')
  })

  it('returns null for nonsense ranges (end before start)', () => {
    expect(
      formatDuration(
        '2026-05-09T00:01:00.000Z',
        '2026-05-09T00:00:00.000Z',
      ),
    ).toBeNull()
  })
})

describe('describeCounts', () => {
  it('renders "In progress…" for running rows with no counts yet', () => {
    expect(describeCounts(run({ status: 'running' }))).toBe('In progress…')
  })

  it('renders "Waiting to start…" for queued rows', () => {
    expect(describeCounts(run({ status: 'queued' }))).toBe('Waiting to start…')
  })

  it('renders the error message for failed rows when present', () => {
    expect(
      describeCounts(
        run({ status: 'failed', errorMessage: 'Airtable rate limit' }),
      ),
    ).toBe('Airtable rate limit')
  })

  it('falls back to "Failed" when the error message is null', () => {
    expect(describeCounts(run({ status: 'failed' }))).toBe('Failed')
  })

  it('surfaces errorMessage on failed runs even when counts are 0 (not null)', () => {
    // The task wrapper's catch branch writes table_count=0 / record_count=0
    // alongside the errorMessage. Without the failed-short-circuit, the
    // counts-only branch would mask the error as "0 tables · 0 records".
    expect(
      describeCounts(
        run({
          status: 'failed',
          tableCount: 0,
          recordCount: 0,
          attachmentCount: 0,
          errorMessage: 'Airtable returned 401: invalid token',
        }),
      ),
    ).toBe('Airtable returned 401: invalid token')
  })

  it('joins counts when the run has captured data', () => {
    expect(
      describeCounts(
        run({
          status: 'succeeded',
          tableCount: 3,
          recordCount: 142,
          attachmentCount: 0,
        }),
      ),
    ).toBe('3 tables · 142 records')
  })

  it('singularizes the labels at count=1', () => {
    expect(
      describeCounts(
        run({
          status: 'succeeded',
          tableCount: 1,
          recordCount: 1,
          attachmentCount: 1,
        }),
      ),
    ).toBe('1 table · 1 record · 1 attachment')
  })

  it('omits attachments when count is zero', () => {
    expect(
      describeCounts(
        run({ status: 'succeeded', tableCount: 2, recordCount: 50, attachmentCount: 0 }),
      ),
    ).not.toContain('attachment')
  })
})

describe('healthStatus', () => {
  it('returns failure for status=failed', () => {
    expect(healthStatus(run({ status: 'failed' }))).toBe('failure')
  })

  it('returns failure for status=failed even when errorMessage is present', () => {
    // 'failed' wins over 'warning' — the order in the rule matters.
    expect(
      healthStatus(run({ status: 'failed', errorMessage: 'boom' })),
    ).toBe('failure')
  })

  it('returns warning for trial_truncated', () => {
    expect(healthStatus(run({ status: 'trial_truncated' }))).toBe('warning')
  })

  it('returns warning when a non-failed run carries a sticky errorMessage', () => {
    // The engine writes errorMessage on partial-success cases as a soft
    // signal even when the status is succeeded. Surface as 'warning'.
    expect(
      healthStatus(run({ status: 'succeeded', errorMessage: 'one base skipped' })),
    ).toBe('warning')
  })

  it('returns good for succeeded with no errorMessage', () => {
    expect(healthStatus(run({ status: 'succeeded' }))).toBe('good')
  })

  it('returns good for running / queued / trial_complete (no signal yet)', () => {
    expect(healthStatus(run({ status: 'running' }))).toBe('good')
    expect(healthStatus(run({ status: 'queued' }))).toBe('good')
    expect(healthStatus(run({ status: 'trial_complete' }))).toBe('good')
  })
})

describe('healthBadgeClass', () => {
  it.each([
    ['good', 'badge-success'],
    ['warning', 'badge-warning'],
    ['failure', 'badge-error'],
  ] as const)('%s → %s', (h, expected) => {
    expect(healthBadgeClass(h)).toBe(expected)
  })
})

describe('formatTriggeredBy', () => {
  it.each([
    ['manual', 'Manual'],
    ['scheduled', 'Scheduled'],
    ['webhook', 'Webhook'],
    ['trial', 'Trial'],
  ])('%s → %s', (input, expected) => {
    expect(formatTriggeredBy(input)).toBe(expected)
  })

  it('title-cases multi-word snake_case values', () => {
    expect(formatTriggeredBy('first_run_manual')).toBe('First Run Manual')
  })

  it('falls back to em-dash for empty input', () => {
    expect(formatTriggeredBy('')).toBe('—')
  })
})

describe('expandedTimestamp', () => {
  it('returns em-dash for null', () => {
    expect(expandedTimestamp(null)).toBe('—')
  })

  it('returns em-dash for unparseable input', () => {
    expect(expandedTimestamp('not-a-date')).toBe('—')
  })

  it('returns a non-empty locale string for a valid ISO timestamp', () => {
    // Don't pin the exact format — locale string varies by Node version
    // and by the host's default locale. Just assert it's a reasonable
    // string with the year in it.
    const out = expandedTimestamp('2026-05-09T18:30:00.000Z')
    expect(out).not.toBe('—')
    expect(out).toMatch(/2026/)
  })
})
