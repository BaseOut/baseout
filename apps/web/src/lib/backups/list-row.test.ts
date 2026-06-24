/**
 * Tests for the BackupsListView row helpers + client-side row template.
 *
 * BackupsListView renders an audit table of backup runs. The SSR frontmatter
 * paints the initial rows with the <Badge>/<Button> catalog components; the
 * live-poll path (widget-lifecycle) re-renders the <tbody> client-side via
 * `backupRowHtml`. Both sides share the status/trigger/format helpers here so
 * the taxonomy can't drift, and `backupRowHtml` is pinned so the client rows
 * match the SSR shape (no flicker on hydration, correct labels, escaped data).
 *
 * Regression context: the redesign promotion dropped live polling AND mislabels
 * the engine's real terminal trial statuses (`trial_complete` / `trial_truncated`)
 * as "Cancelled" via a fallback. These tests lock the corrected taxonomy.
 */

import { describe, expect, it } from 'vitest'
import {
  backupRowHtml,
  durationStr,
  isActiveStatus,
  isOkStatus,
  statusMetaFor,
  triggerKey,
  triggerLabel,
} from './list-row'
import type { BackupRunSummary } from '../backup-runs/types'

function makeRun(overrides: Partial<BackupRunSummary> = {}): BackupRunSummary {
  return {
    id: 'r_1',
    status: 'succeeded',
    isTrial: false,
    triggeredBy: 'manual',
    recordCount: null,
    tableCount: null,
    attachmentCount: null,
    startedAt: '2026-06-24T10:00:00.000Z',
    completedAt: '2026-06-24T10:00:30.000Z',
    errorMessage: null,
    triggerRunIds: null,
    createdAt: '2026-06-24T10:00:00.000Z',
    connection: null,
    configuration: null,
    includedBases: [],
    ...overrides,
  }
}

describe('statusMetaFor', () => {
  it.each([
    ['succeeded', 'Succeeded', 'success'],
    ['trial_complete', 'Trial run', 'success'],
    ['trial_truncated', 'Trial run', 'warning'],
    ['running', 'Running', 'warning'],
    ['queued', 'Queued', 'default'],
    ['failed', 'Failed', 'error'],
    ['cancelled', 'Cancelled', 'default'],
  ] as const)('maps %s → %s/%s', (status, label, variant) => {
    expect(statusMetaFor(status)).toEqual({ label, variant })
  })

  it('falls back to the raw status (NOT "Cancelled") for unknown statuses', () => {
    // The old view did `statusMeta[status] ?? statusMeta.cancelled`, which
    // mislabeled every unmapped status — including the engine's real trial
    // terminals — as "Cancelled". The fallback must be neutral.
    expect(statusMetaFor('something_unknown')).toEqual({
      label: 'something_unknown',
      variant: 'default',
    })
  })
})

describe('isOkStatus', () => {
  it.each([
    ['succeeded', true],
    ['trial_complete', true],
    ['trial_truncated', true],
    ['running', false],
    ['queued', false],
    ['failed', false],
    ['cancelled', false],
  ] as const)('isOkStatus(%s) → %s', (status, expected) => {
    expect(isOkStatus(status)).toBe(expected)
  })
})

describe('isActiveStatus', () => {
  it.each([
    ['running', true],
    ['queued', true],
    ['succeeded', false],
    ['failed', false],
    ['cancelled', false],
  ] as const)('isActiveStatus(%s) → %s', (status, expected) => {
    expect(isActiveStatus(status)).toBe(expected)
  })
})

describe('triggerLabel / triggerKey', () => {
  it.each([
    ['onboarding', 'Trial', 'trial'],
    ['schedule_daily', 'Scheduled', 'scheduled'],
    ['webhook_xyz', 'Webhook', 'webhook'],
    ['manual', 'Manual', 'manual'],
  ] as const)('%s → %s/%s', (raw, label, key) => {
    expect(triggerLabel(raw)).toBe(label)
    expect(triggerKey(raw)).toBe(key)
  })
})

describe('durationStr', () => {
  it('returns — when either bound is missing', () => {
    expect(durationStr(null, '2026-06-24T10:00:30.000Z')).toBe('—')
    expect(durationStr('2026-06-24T10:00:00.000Z', null)).toBe('—')
  })
  it('formats seconds and minutes', () => {
    expect(durationStr('2026-06-24T10:00:00.000Z', '2026-06-24T10:00:42.000Z')).toBe('42s')
    expect(durationStr('2026-06-24T10:00:00.000Z', '2026-06-24T10:02:05.000Z')).toBe('2m 5s')
  })
})

describe('backupRowHtml', () => {
  it('renders a running row with a spinner, Running label, and live placeholders', () => {
    const html = backupRowHtml(makeRun({ id: 'r_run', status: 'running', completedAt: null }))
    expect(html).toContain('data-status="running"')
    expect(html).toContain('loading loading-spinner loading-xs')
    expect(html).toContain('badge-soft badge-warning')
    expect(html).toContain('Running')
    expect(html).toContain('in progress')
    // records / attachments / duration are placeholders while in flight
    expect(html).toContain('—')
    // drill link uses the run id (embedded production form)
    expect(html).toContain('/backups/run?id=r_run')
  })

  it('renders a succeeded row with formatted counts and no spinner', () => {
    const html = backupRowHtml(
      makeRun({ id: 'r_ok', status: 'succeeded', recordCount: 1234, attachmentCount: 5 }),
    )
    expect(html).toContain('badge-soft badge-success')
    expect(html).toContain('Succeeded')
    expect(html).toContain('1,234')
    expect(html).toContain('>5<')
    expect(html).not.toContain('loading-spinner')
  })

  it('renders a failed row with the error variant and dashed counts', () => {
    const html = backupRowHtml(makeRun({ id: 'r_bad', status: 'failed', errorMessage: 'boom' }))
    expect(html).toContain('badge-soft badge-error')
    expect(html).toContain('Failed')
  })

  it('renders a trial_complete row as "Trial run"/success, NOT "Cancelled"', () => {
    // The taxonomy regression lock: the engine emits trial_complete; the row
    // must not fall through to the Cancelled fallback.
    const html = backupRowHtml(makeRun({ id: 'r_trial', status: 'trial_complete', recordCount: 10 }))
    expect(html).toContain('Trial run')
    expect(html).toContain('badge-soft badge-success')
    expect(html).not.toContain('Cancelled')
  })

  it('HTML-escapes error text folded into data-search (no markup injection)', () => {
    const html = backupRowHtml(
      makeRun({ id: 'r_x', status: 'failed', errorMessage: '<img src=x onerror=alert(1)>' }),
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})
