import { describe, expect, it } from 'vitest'
import {
  backupRunTitle,
  deriveSpaceHealth,
  describeCounts,
  expandedTimestamp,
  formatDeletedAt,
  formatDuration,
  formatNextScheduledAt,
  formatTriggeredBy,
  healthBadgeClass,
  healthStatus,
  isInFlightRun,
  isSuccessRun,
  isWebhookRun,
  kindBadgeClass,
  kindLabel,
  runKind,
  runMovedAt,
  statusBadgeClass,
  statusLabel,
  webhookSourceLine,
} from './format'
import type { BackupRunSummary } from '../backup-runs/types'

describe('kindLabel', () => {
  it('labels full and schema runs', () => {
    expect(kindLabel('full')).toBe('Full')
    expect(kindLabel('schema')).toBe('Schema')
  })
  it('treats unknown/legacy values as Full', () => {
    expect(kindLabel('')).toBe('Full')
    expect(kindLabel('weird')).toBe('Full')
  })
})

describe('kindBadgeClass', () => {
  it('distinguishes schema from full', () => {
    expect(kindBadgeClass('schema')).toBe('badge-info')
    expect(kindBadgeClass('full')).toBe('badge-ghost')
  })
})

function run(overrides: Partial<BackupRunSummary> = {}): BackupRunSummary {
  return {
    id: 'r_1',
    status: 'queued',
    kind: 'full',
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
    ['cancelling', 'Cancelling'],
    ['cancelled', 'Cancelled'],
    ['deleting', 'Deleting'],
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
    ['cancelling', 'badge-warning'],
    ['cancelled', 'badge-neutral'],
    ['deleting', 'badge-warning'],
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

  it('renders "Backing up… N records" for running rows with a live counter (Phase 10d)', () => {
    // The engine's /api/internal/runs/:id/progress route bumps record_count
    // as table-page uploads land. While status='running', we surface that
    // counter as the row body so users see motion before /complete writes
    // the final totals.
    expect(
      describeCounts(
        run({ status: 'running', recordCount: 142, tableCount: 0 }),
      ),
    ).toBe('Backing up… 142 records')
  })

  it('renders "Backing up… 1 record" (singular) at recordCount=1', () => {
    expect(
      describeCounts(
        run({ status: 'running', recordCount: 1, tableCount: 0 }),
      ),
    ).toBe('Backing up… 1 record')
  })

  it('renders "Backing up… 0 records" when only tableCount has been bumped yet', () => {
    // Initial state right after the engine writes its first /progress with
    // tableCompleted=true but record-count is still 0. The counter still
    // renders rather than falling back to "In progress…".
    expect(
      describeCounts(
        run({ status: 'running', recordCount: 0, tableCount: 1 }),
      ),
    ).toBe('Backing up… 0 records')
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

describe('formatNextScheduledAt', () => {
  it('returns "Not yet scheduled" for null', () => {
    expect(formatNextScheduledAt(null)).toBe('Not yet scheduled')
  })

  it('returns "Not yet scheduled" for unparseable input', () => {
    expect(formatNextScheduledAt('not-a-date')).toBe('Not yet scheduled')
  })

  it('returns a non-empty locale string with the year for a valid ISO timestamp', () => {
    const out = formatNextScheduledAt('2026-06-01T00:00:00.000Z')
    expect(out).not.toBe('Not yet scheduled')
    expect(out).toMatch(/2026/)
  })

  it('includes a time component (Intl.DateTimeFormat timeStyle: short)', () => {
    // We don't pin the exact format (locale + TZ vary) — just assert
    // a digit-digit time substring is present so the formatter never
    // silently drops time-of-day.
    const out = formatNextScheduledAt('2026-06-01T13:45:00.000Z')
    expect(out).toMatch(/\d{1,2}:\d{2}/)
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

describe('formatDeletedAt', () => {
  it('returns "" for null (run not pruned)', () => {
    expect(formatDeletedAt(null)).toBe('')
  })

  it('returns "" for unparseable input', () => {
    expect(formatDeletedAt('not-a-date')).toBe('')
  })

  it('prefixes "Pruned" with the date for a valid ISO timestamp', () => {
    const out = formatDeletedAt('2026-06-01T00:00:00.000Z')
    expect(out).toMatch(/^Pruned /)
    expect(out).toMatch(/2026/)
  })
})

// ── web-instant-webhook: ⚡ webhook-run affordances ──────────────────────────

describe('isWebhookRun', () => {
  it('matches the engine trigger vocabulary', () => {
    expect(isWebhookRun('webhook')).toBe(true)
    expect(isWebhookRun('webhook_poll')).toBe(true)
    expect(isWebhookRun('manual')).toBe(false)
    expect(isWebhookRun('scheduled')).toBe(false)
    expect(isWebhookRun('')).toBe(false)
  })
})

describe('webhookSourceLine', () => {
  it('returns null for non-webhook runs', () => {
    expect(webhookSourceLine(run({ triggeredBy: 'manual' }))).toBeNull()
  })

  it('renders the full counts line when change counts are present', () => {
    const line = webhookSourceLine(
      run({
        triggeredBy: 'webhook',
        createdCount: 3,
        updatedCount: 12,
        deletedCount: 0,
      }),
    )
    expect(line).toBe('Source: Webhook · 3 created · 12 updated · 0 deleted')
  })

  it('appends reconciled records when a reconciliation pass contributed', () => {
    const line = webhookSourceLine(
      run({
        triggeredBy: 'webhook_poll',
        createdCount: 1,
        updatedCount: 0,
        deletedCount: 2,
        reconciledRecords: 4,
      }),
    )
    expect(line).toBe(
      'Source: Webhook · 1 created · 0 updated · 2 deleted · 4 reconciled',
    )
  })

  it('omits a zero reconciled count', () => {
    const line = webhookSourceLine(
      run({
        triggeredBy: 'webhook',
        createdCount: 1,
        updatedCount: 1,
        deletedCount: 1,
        reconciledRecords: 0,
      }),
    )
    expect(line).toBe('Source: Webhook · 1 created · 1 updated · 1 deleted')
  })

  it('falls back to "Source: Webhook" while counts are not yet persisted', () => {
    // backup_runs has no created/updated/deleted columns yet — the engine's
    // completion payload will persist them in server-instant-webhook. Until
    // then the line renders from what exists.
    expect(webhookSourceLine(run({ triggeredBy: 'webhook' }))).toBe(
      'Source: Webhook',
    )
  })
})

// ── Space-health derivation (promoted from ui-only@7c7202d7) ──────────────────
const NOW = Date.parse('2026-05-10T00:00:00.000Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

describe('runKind', () => {
  it('maps schema runs to schema and everything else to full', () => {
    expect(runKind(run({ kind: 'schema' }))).toBe('schema')
    expect(runKind(run({ kind: 'full' }))).toBe('full')
    expect(runKind(run({ kind: 'restore' }))).toBe('full')
  })
})

describe('isSuccessRun / isInFlightRun', () => {
  it('classifies terminal successes as success', () => {
    expect(isSuccessRun(run({ status: 'succeeded' }))).toBe(true)
    expect(isSuccessRun(run({ status: 'trial_succeeded' }))).toBe(true)
    expect(isSuccessRun(run({ status: 'failed' }))).toBe(false)
  })
  it('treats queued/running/cancelling/paused as in-flight (paused is not terminal)', () => {
    for (const status of ['queued', 'running', 'cancelling', 'paused']) {
      expect(isInFlightRun(run({ status }))).toBe(true)
    }
    expect(isInFlightRun(run({ status: 'succeeded' }))).toBe(false)
  })
})

describe('runMovedAt', () => {
  it('prefers completedAt, then startedAt, then createdAt', () => {
    expect(
      runMovedAt(
        run({
          completedAt: '2026-05-09T03:00:00.000Z',
          startedAt: '2026-05-09T02:00:00.000Z',
          createdAt: '2026-05-09T01:00:00.000Z',
        }),
      ),
    ).toBe(Date.parse('2026-05-09T03:00:00.000Z'))
    expect(
      runMovedAt(run({ completedAt: null, startedAt: '2026-05-09T02:00:00.000Z' })),
    ).toBe(Date.parse('2026-05-09T02:00:00.000Z'))
    expect(
      runMovedAt(run({ completedAt: null, startedAt: null, createdAt: '2026-05-09T01:00:00.000Z' })),
    ).toBe(Date.parse('2026-05-09T01:00:00.000Z'))
  })
})

describe('deriveSpaceHealth', () => {
  it('is unknown with no runs', () => {
    const h = deriveSpaceHealth({ now: NOW })
    expect(h.level).toBe('unknown')
    expect(h.headline).toBe('No backup has run yet')
    expect(h.lastRun).toBeNull()
    expect(h.banner).toBeNull()
  })

  it('is broken (and names the side) when a connection lost access', () => {
    const h = deriveSpaceHealth({
      now: NOW,
      runs: [run({ status: 'succeeded', completedAt: '2026-05-09T23:00:00.000Z' })],
      brokenSource: { name: 'Acme Airtable' },
      sourceName: 'Acme Airtable',
    })
    expect(h.level).toBe('broken')
    expect(h.brokenSide).toBe('source')
    expect(h.brokenName).toBe('Acme Airtable')
    expect(h.headline).toBe('Backups paused')
    expect(h.banner).toEqual({
      state: 'broken',
      provider: 'Acme Airtable',
      side: 'source',
      lastBackup: '1h ago',
    })
    // A broken connection does not un-write the last success.
    expect(h.lastSuccessAt).toBe('2026-05-09T23:00:00.000Z')
  })

  it('is running while a run is in flight', () => {
    const h = deriveSpaceHealth({
      now: NOW,
      runs: [run({ status: 'running', startedAt: '2026-05-09T23:59:00.000Z' })],
    })
    expect(h.level).toBe('running')
    expect(h.headline).toBe('Backup running…')
  })

  it('is failed when the newest run failed, and flags successDiffers with an older success', () => {
    const h = deriveSpaceHealth({
      now: NOW,
      runs: [
        run({ id: 'r_new', status: 'failed', completedAt: '2026-05-09T23:00:00.000Z', errorMessage: 'boom' }),
        run({ id: 'r_old', status: 'succeeded', completedAt: '2026-05-08T23:00:00.000Z' }),
      ],
    })
    expect(h.level).toBe('failed')
    expect(h.headline).toBe('Last run failed')
    expect(h.lastRun?.id).toBe('r_new')
    expect(h.lastSuccess?.id).toBe('r_old')
    expect(h.successDiffers).toBe(true)
  })

  it('is ok after a recent success with a future schedule', () => {
    const h = deriveSpaceHealth({
      now: NOW,
      runs: [run({ status: 'succeeded', completedAt: new Date(NOW - HOUR).toISOString() })],
      nextScheduledAt: new Date(NOW + DAY).toISOString(),
    })
    expect(h.level).toBe('ok')
    expect(h.headline).toBe('Backed up 1h ago')
    expect(h.successDiffers).toBe(false)
  })

  it('is degraded when the last success is older than 24h and nothing is in flight', () => {
    const h = deriveSpaceHealth({
      now: NOW,
      runs: [run({ status: 'succeeded', completedAt: new Date(NOW - 2 * DAY).toISOString() })],
      sourceName: 'Acme Airtable',
    })
    expect(h.level).toBe('degraded')
    expect(h.headline).toBe('No successful backup in 24 hours')
    expect(h.banner).toEqual({ state: 'degraded', provider: 'Acme Airtable', side: 'source' })
  })

  it('is overdue when a recent success has a schedule already in the past', () => {
    const h = deriveSpaceHealth({
      now: NOW,
      runs: [run({ status: 'succeeded', completedAt: new Date(NOW - HOUR).toISOString() })],
      nextScheduledAt: new Date(NOW - HOUR).toISOString(),
    })
    expect(h.level).toBe('overdue')
    expect(h.overdue).toBe(true)
  })

  it('picks the newest FULL success for lastFullSuccess, not a later schema run', () => {
    const h = deriveSpaceHealth({
      now: NOW,
      runs: [
        run({ id: 'r_schema', kind: 'schema', status: 'succeeded', completedAt: '2026-05-09T23:00:00.000Z' }),
        run({ id: 'r_full', kind: 'full', status: 'succeeded', completedAt: '2026-05-09T20:00:00.000Z' }),
      ],
    })
    expect(h.lastSuccess?.id).toBe('r_schema')
    expect(h.lastFullSuccess?.id).toBe('r_full')
  })
})


describe('backupRunTitle', () => {
  it('titles a run by its timestamp', () => {
    expect(backupRunTitle('2026-05-09T20:00:00.000Z')).toMatch(/^Backup run · /)
  })

  it('falls back to a bare label when there is no timestamp', () => {
    expect(backupRunTitle(null)).toBe('Backup run')
    expect(backupRunTitle(undefined)).toBe('Backup run')
  })
})
