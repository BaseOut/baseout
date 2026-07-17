import { describe, expect, it } from 'vitest'
import { buildRunDetail, BASE_STATUS_BADGE, type RunBaseRow, type RunTableRow } from './run-detail'

function base(overrides: Partial<RunBaseRow> = {}): RunBaseRow {
  return {
    id: 'rb1',
    atBaseId: 'appX',
    baseName: 'CRM',
    status: 'succeeded',
    tablesCount: 2,
    recordsCount: 50,
    attachmentsCount: 0,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    ...overrides,
  }
}

function table(overrides: Partial<RunTableRow> = {}): RunTableRow {
  return {
    runBaseId: 'rb1',
    tableId: 'tblA',
    tableName: 'Contacts',
    recordCount: 25,
    fieldCount: 8,
    attachmentCount: 0,
    ...overrides,
  }
}

describe('buildRunDetail', () => {
  it('groups tables under their base, preserving base order', () => {
    const detail = buildRunDetail(
      [base(), base({ id: 'rb2', baseName: 'Ops' })],
      [table(), table({ tableId: 'tblB', tableName: 'Deals' }), table({ runBaseId: 'rb2', tableId: 'tblC' })],
    )
    expect(detail.map((d) => d.id)).toEqual(['rb1', 'rb2'])
    expect(detail[0].tables.map((t) => t.tableId)).toEqual(['tblA', 'tblB'])
    expect(detail[1].tables.map((t) => t.tableId)).toEqual(['tblC'])
  })

  it('gives a base with no table rows an empty list', () => {
    const detail = buildRunDetail([base()], [])
    expect(detail[0].tables).toEqual([])
  })

  it('handles the legacy no-snapshot case (no bases at all)', () => {
    expect(buildRunDetail([], [table()])).toEqual([])
  })
})

describe('BASE_STATUS_BADGE', () => {
  it('covers the base status vocabulary', () => {
    expect(BASE_STATUS_BADGE.succeeded).toBe('success')
    expect(BASE_STATUS_BADGE.failed).toBe('error')
    expect(BASE_STATUS_BADGE.trial_complete).toBe('warning')
    expect(BASE_STATUS_BADGE.trial_truncated).toBe('warning')
  })
})
