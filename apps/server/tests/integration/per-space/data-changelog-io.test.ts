import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  parseChangelogRequest,
  buildRollupQuery,
  buildRowsQuery,
  type ChangelogFilters,
} from '../../../src/lib/per-space/record-changelog-io'
import type { Cursor } from '../../../src/lib/per-space/record-read'

const dialect = new PgDialect()
const render = (q: SQL) => dialect.sqlToQuery(q)
const sp = (init: Record<string, string>) => new URLSearchParams(init)

const emptyFilters: ChangelogFilters = {
  baseId: null,
  tableId: null,
  fieldId: null,
  from: null,
  to: null,
  fromRun: null,
  toRun: null,
}

describe('parseChangelogRequest', () => {
  it('defaults to rollup mode with no filters', () => {
    const p = parseChangelogRequest(sp({}))
    expect(p.mode).toBe('rollup')
    expect(p.runId).toBeNull()
    expect(p.changeType).toBeNull()
    expect(p.errors).toEqual([])
    expect(p.limit).toBe(50) // DEFAULT_PAGE_SIZE
    expect(p.filters).toEqual(emptyFilters)
  })

  it('switches to rows mode when runId is present, defaulting changeType to updated', () => {
    const runId = '11111111-1111-1111-1111-111111111111'
    const p = parseChangelogRequest(sp({ runId }))
    expect(p.mode).toBe('rows')
    expect(p.runId).toBe(runId)
    expect(p.changeType).toBe('updated')
    expect(p.errors).toEqual([])
  })

  it('honours an explicit changeType in rows mode', () => {
    const runId = '11111111-1111-1111-1111-111111111111'
    expect(parseChangelogRequest(sp({ runId, changeType: 'created' })).changeType).toBe('created')
    expect(parseChangelogRequest(sp({ runId, changeType: 'deleted' })).changeType).toBe('deleted')
  })

  it('extracts all filters', () => {
    const p = parseChangelogRequest(
      sp({
        baseId: 'appABC',
        tableId: 'tblXYZ',
        fieldId: 'fld123',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-02-01T00:00:00.000Z',
        fromRun: '22222222-2222-2222-2222-222222222222',
        toRun: '33333333-3333-3333-3333-333333333333',
      }),
    )
    expect(p.filters).toEqual({
      baseId: 'appABC',
      tableId: 'tblXYZ',
      fieldId: 'fld123',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-02-01T00:00:00.000Z',
      fromRun: '22222222-2222-2222-2222-222222222222',
      toRun: '33333333-3333-3333-3333-333333333333',
    })
  })

  it('clamps limit to the [1, 200] window', () => {
    expect(parseChangelogRequest(sp({ limit: '9999' })).limit).toBe(200)
    expect(parseChangelogRequest(sp({ limit: '25' })).limit).toBe(25)
    expect(parseChangelogRequest(sp({ limit: '0' })).limit).toBe(50)
  })

  it('rejects a bad changeType', () => {
    const p = parseChangelogRequest(sp({ changeType: 'renamed' }))
    expect(p.errors.some((e) => e.includes('changeType'))).toBe(true)
  })

  it('rejects non-UUID run identifiers', () => {
    const p = parseChangelogRequest(sp({ runId: 'not-a-uuid', fromRun: 'nope', toRun: 'bad' }))
    expect(p.errors.some((e) => e.includes('runId'))).toBe(true)
    expect(p.errors.some((e) => e.includes('fromRun'))).toBe(true)
    expect(p.errors.some((e) => e.includes('toRun'))).toBe(true)
  })

  it('rejects non-ISO date bounds', () => {
    const p = parseChangelogRequest(sp({ from: 'yesterday', to: 'also-bad' }))
    expect(p.errors.some((e) => e.includes('from'))).toBe(true)
    expect(p.errors.some((e) => e.includes('to'))).toBe(true)
  })
})

describe('buildRollupQuery', () => {
  it('emits the created / deleted / updated per-run count subqueries', () => {
    const { sql } = render(buildRollupQuery({ filters: emptyFilters, cursor: null, limit: 50 }))
    const s = sql.toLowerCase()
    // created = first_seen_run, deleted = first_unseen_run, updated = distinct record_updates
    expect(s).toContain('first_seen_run = r.id')
    expect(s).toContain('first_unseen_run = r.id')
    expect(s).toContain('count(distinct ru.record_id)')
    expect(s).toContain('from bo_at_record_updates ru where ru.run_id = r.id')
    expect(s).toContain('from bo_at_base_runs r')
    // newest-first over the run timeline
    expect(s).toContain('order by r.started_at desc nulls last, r.id desc')
    expect(s).toContain('limit')
  })

  it('binds base / table / field filters as parameters (never inlined)', () => {
    const filters: ChangelogFilters = {
      ...emptyFilters,
      baseId: 'appABC',
      tableId: 'tblXYZ',
      fieldId: 'fld123',
    }
    const q = render(buildRollupQuery({ filters, cursor: null, limit: 50 }))
    const s = q.sql.toLowerCase()
    expect(s).toContain('r.base_id = $')
    expect(s).toContain('rec.table_id = $') // inside the lifecycle count subqueries
    expect(s).toContain('ru.field_id = $') // inside the updated count subquery
    expect(q.params).toContain('appABC')
    expect(q.params).toContain('tblXYZ')
    expect(q.params).toContain('fld123')
    // no filter value leaked into the SQL text
    expect(q.sql).not.toContain('appABC')
    expect(q.sql).not.toContain('tblXYZ')
    expect(q.sql).not.toContain('fld123')
  })

  it('binds the date range (from/to) as timestamptz parameters', () => {
    const filters: ChangelogFilters = {
      ...emptyFilters,
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-02-01T00:00:00.000Z',
    }
    const q = render(buildRollupQuery({ filters, cursor: null, limit: 50 }))
    const s = q.sql.toLowerCase()
    expect(s).toContain('r.started_at >= $')
    expect(s).toContain('r.started_at <= $')
    expect(s).toContain('::timestamptz')
    expect(q.params).toContain('2026-01-01T00:00:00.000Z')
    expect(q.params).toContain('2026-02-01T00:00:00.000Z')
  })

  it('binds the run range (fromRun/toRun) via bound uuid subqueries', () => {
    const filters: ChangelogFilters = {
      ...emptyFilters,
      fromRun: '22222222-2222-2222-2222-222222222222',
      toRun: '33333333-3333-3333-3333-333333333333',
    }
    const q = render(buildRollupQuery({ filters, cursor: null, limit: 50 }))
    const s = q.sql.toLowerCase()
    expect(s).toContain('select started_at from bo_at_base_runs where id = $')
    expect(q.params).toContain('22222222-2222-2222-2222-222222222222')
    expect(q.params).toContain('33333333-3333-3333-3333-333333333333')
  })

  it('adds the keyset predicate for a non-null cursor and binds its parts', () => {
    const cursor: Cursor = {
      sortField: 'started_at',
      sortValue: '2026-01-15T00:00:00.000Z',
      recordId: '44444444-4444-4444-4444-444444444444',
    }
    const q = render(buildRollupQuery({ filters: emptyFilters, cursor, limit: 50 }))
    const s = q.sql.toLowerCase()
    expect(s).toContain('r.started_at < $') // desc → strictly-below the cursor value
    expect(s).toContain('is null') // NULLS-LAST tail
    expect(s).toContain('r.id < $') // id-desc tiebreak
    expect(q.params).toContain('2026-01-15T00:00:00.000Z')
    expect(q.params).toContain('44444444-4444-4444-4444-444444444444')
  })

  it('handles a null-value cursor (the NULLS-LAST tail) with just the id tiebreak', () => {
    const cursor: Cursor = {
      sortField: 'started_at',
      sortValue: null,
      recordId: '44444444-4444-4444-4444-444444444444',
    }
    const q = render(buildRollupQuery({ filters: emptyFilters, cursor, limit: 50 }))
    const s = q.sql.toLowerCase()
    expect(s).toContain('r.started_at is null and r.id < $')
    expect(s).not.toContain('::timestamptz') // no value comparison in the tail
    expect(q.params).toContain('44444444-4444-4444-4444-444444444444')
  })

  it('requests limit + 1 to detect the next page', () => {
    const q = render(buildRollupQuery({ filters: emptyFilters, cursor: null, limit: 50 }))
    expect(q.params).toContain(51)
  })
})

describe('buildRowsQuery', () => {
  const runId = '55555555-5555-5555-5555-555555555555'

  it('created rows: filter on first_seen_run, id-ascending, bound run id', () => {
    const q = render(
      buildRowsQuery({ runId, changeType: 'created', filters: emptyFilters, cursor: null, limit: 50 }),
    )
    const s = q.sql.toLowerCase()
    expect(s).toContain('from bo_at_records rec')
    expect(s).toContain('rec.first_seen_run = $')
    expect(s).toContain('order by rec.record_id asc')
    expect(q.params).toContain(runId)
    expect(q.sql).not.toContain(runId) // bound, not inlined
  })

  it('deleted rows: filter on first_unseen_run', () => {
    const q = render(
      buildRowsQuery({ runId, changeType: 'deleted', filters: emptyFilters, cursor: null, limit: 50 }),
    )
    expect(q.sql.toLowerCase()).toContain('rec.first_unseen_run = $')
    expect(q.params).toContain(runId)
  })

  it('updated rows: join + array_agg of changed fields, grouped, run bound', () => {
    const q = render(
      buildRowsQuery({ runId, changeType: 'updated', filters: emptyFilters, cursor: null, limit: 50 }),
    )
    const s = q.sql.toLowerCase()
    expect(s).toContain('from bo_at_record_updates ru')
    expect(s).toContain('left join bo_at_records rec on rec.record_id = ru.record_id')
    expect(s).toContain('array_agg(distinct ru.field_id)')
    expect(s).toContain('ru.run_id = $')
    expect(s).toContain('group by')
    expect(s).toContain('order by ru.record_id asc')
    expect(q.params).toContain(runId)
  })

  it('updated rows: fieldId + tableId + baseId filters bind as params', () => {
    const filters: ChangelogFilters = {
      ...emptyFilters,
      baseId: 'appABC',
      tableId: 'tblXYZ',
      fieldId: 'fld123',
    }
    const q = render(buildRowsQuery({ runId, changeType: 'updated', filters, cursor: null, limit: 50 }))
    const s = q.sql.toLowerCase()
    expect(s).toContain('ru.table_id = $')
    expect(s).toContain('ru.field_id = $')
    expect(s).toContain('rec.base_id = $')
    expect(q.params).toEqual(expect.arrayContaining(['appABC', 'tblXYZ', 'fld123']))
  })

  it('created rows: base/table filters bind on bo_at_records', () => {
    const filters: ChangelogFilters = { ...emptyFilters, baseId: 'appABC', tableId: 'tblXYZ' }
    const q = render(buildRowsQuery({ runId, changeType: 'created', filters, cursor: null, limit: 50 }))
    const s = q.sql.toLowerCase()
    expect(s).toContain('rec.base_id = $')
    expect(s).toContain('rec.table_id = $')
    expect(q.params).toEqual(expect.arrayContaining(['appABC', 'tblXYZ']))
  })

  it('applies the record_id keyset for a cursor and binds it', () => {
    const cursor: Cursor = { sortField: 'record_id', sortValue: 'recM', recordId: 'recM' }
    const created = render(buildRowsQuery({ runId, changeType: 'created', filters: emptyFilters, cursor, limit: 50 }))
    expect(created.sql.toLowerCase()).toContain('rec.record_id > $')
    expect(created.params).toContain('recM')

    const updated = render(buildRowsQuery({ runId, changeType: 'updated', filters: emptyFilters, cursor, limit: 50 }))
    expect(updated.sql.toLowerCase()).toContain('ru.record_id > $')
    expect(updated.params).toContain('recM')
  })

  it('requests limit + 1 to detect the next page', () => {
    const q = render(buildRowsQuery({ runId, changeType: 'created', filters: emptyFilters, cursor: null, limit: 50 }))
    expect(q.params).toContain(51)
  })
})
