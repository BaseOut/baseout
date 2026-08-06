import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  assignRunSeq,
  baseRunsByIdsQuery,
  currentFieldDataQuery,
  recordMarkersQuery,
  recordUpdatesQuery,
  type RunTimeRow,
} from '../../../src/lib/per-space/record-history-io'
import {
  recordAttachmentsQuery,
  recordFieldsQuery,
  recordRowQuery,
} from '../../../src/lib/per-space/record-detail-io'

const dialect = new PgDialect()
const render = (q: SQL) => dialect.sqlToQuery(q)

describe('assignRunSeq', () => {
  it('ranks runs oldest→newest by started_at (0 = oldest)', () => {
    const runs: RunTimeRow[] = [
      { runId: 'c', startedAt: '2026-03-01T00:00:00.000Z', completedAt: null },
      { runId: 'a', startedAt: '2026-01-01T00:00:00.000Z', completedAt: null },
      { runId: 'b', startedAt: '2026-02-01T00:00:00.000Z', completedAt: null },
    ]
    const seq = assignRunSeq(runs)
    expect(seq.get('a')).toBe(0)
    expect(seq.get('b')).toBe(1)
    expect(seq.get('c')).toBe(2)
  })

  it('falls back to completed_at when started_at is null, and empty-key sorts oldest', () => {
    const runs: RunTimeRow[] = [
      { runId: 'later', startedAt: '2026-05-01T00:00:00.000Z', completedAt: null },
      { runId: 'viaCompleted', startedAt: null, completedAt: '2026-04-01T00:00:00.000Z' },
      { runId: 'noTimes', startedAt: null, completedAt: null },
    ]
    const seq = assignRunSeq(runs)
    // noTimes → key '' sorts first; then completed_at fallback; then started_at.
    expect(seq.get('noTimes')).toBe(0)
    expect(seq.get('viaCompleted')).toBe(1)
    expect(seq.get('later')).toBe(2)
  })

  it('breaks ties on equal timestamps deterministically by run id', () => {
    const t = '2026-01-01T00:00:00.000Z'
    const seq = assignRunSeq([
      { runId: 'z', startedAt: t, completedAt: null },
      { runId: 'a', startedAt: t, completedAt: null },
    ])
    expect(seq.get('a')).toBe(0)
    expect(seq.get('z')).toBe(1)
  })

  it('is empty for an empty input', () => {
    expect(assignRunSeq([]).size).toBe(0)
  })
})

describe('record-detail SQL builders', () => {
  it('recordRowQuery: bo_at_records selected by record_id, single param', () => {
    const q = render(recordRowQuery('recABC'))
    expect(q.sql).toContain('from bo_at_records')
    expect(q.sql).toContain('where record_id = $1')
    expect(q.sql).toContain('limit 1')
    expect(q.params).toEqual(['recABC'])
  })

  it('recordFieldsQuery: bo_at_record_field_data by record_id', () => {
    const q = render(recordFieldsQuery('recABC'))
    expect(q.sql).toContain('from bo_at_record_field_data')
    expect(q.sql).toContain('where record_id = $1')
    expect(q.params).toEqual(['recABC'])
  })

  it('recordAttachmentsQuery: projects the attachment columns by record_id', () => {
    const q = render(recordAttachmentsQuery('recABC'))
    expect(q.sql).toContain('from bo_at_attachments')
    expect(q.sql).toContain('composite_id')
    expect(q.sql).toContain('size_bytes')
    expect(q.sql).toContain('upload_status')
    expect(q.sql).toContain('storage_key')
    expect(q.sql).toContain('where record_id = $1')
    expect(q.params).toEqual(['recABC'])
  })
})

describe('record-history SQL builders', () => {
  it('recordMarkersQuery: selects the lifecycle markers by record_id', () => {
    const q = render(recordMarkersQuery('recABC'))
    expect(q.sql).toContain('first_seen_run')
    expect(q.sql).toContain('first_unseen_run')
    expect(q.sql).toContain('from bo_at_records')
    expect(q.params).toEqual(['recABC'])
  })

  it('recordUpdatesQuery: superseded-value log by record_id', () => {
    const q = render(recordUpdatesQuery('recABC'))
    expect(q.sql).toContain('old_value')
    expect(q.sql).toContain('from bo_at_record_updates')
    expect(q.sql).toContain('where record_id = $1')
    expect(q.params).toEqual(['recABC'])
  })

  it('currentFieldDataQuery: current values by record_id', () => {
    const q = render(currentFieldDataQuery('recABC'))
    expect(q.sql).toContain('from bo_at_record_field_data')
    expect(q.params).toEqual(['recABC'])
  })

  it('baseRunsByIdsQuery: one ::uuid-cast param per id, IN list', () => {
    const q = render(baseRunsByIdsQuery(['id1', 'id2', 'id3']))
    expect(q.sql).toContain('from bo_at_base_runs')
    expect(q.sql).toContain('where id in ($1::uuid, $2::uuid, $3::uuid)')
    expect(q.params).toEqual(['id1', 'id2', 'id3'])
  })
})
