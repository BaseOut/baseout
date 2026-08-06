import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import {
  recordUpdatesPruneCutoff,
  pruneRecordUpdatesSql,
} from '../../../src/lib/per-space/record-updates-prune'

const dialect = new PgDialect()

describe('recordUpdatesPruneCutoff', () => {
  const now = new Date('2026-08-04T12:00:00.000Z')

  it('subtracts the retention window and returns an ISO cutoff', () => {
    expect(recordUpdatesPruneCutoff(now, 30)).toBe('2026-07-05T12:00:00.000Z')
    expect(recordUpdatesPruneCutoff(now, 1)).toBe('2026-08-03T12:00:00.000Z')
  })

  it('no-ops (null) for a non-positive or invalid window — never deletes everything', () => {
    expect(recordUpdatesPruneCutoff(now, 0)).toBeNull()
    expect(recordUpdatesPruneCutoff(now, -5)).toBeNull()
    expect(recordUpdatesPruneCutoff(now, Number.NaN)).toBeNull()
    expect(recordUpdatesPruneCutoff(now, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('handles fractional days', () => {
    expect(recordUpdatesPruneCutoff(now, 0.5)).toBe('2026-08-04T00:00:00.000Z')
  })
})

describe('pruneRecordUpdatesSql', () => {
  it('deletes only rows whose completed run predates the cutoff; cutoff is bound', () => {
    const q = dialect.sqlToQuery(pruneRecordUpdatesSql('2026-07-05T12:00:00.000Z'))
    const s = q.sql.toLowerCase()
    expect(s).toContain('delete from bo_at_record_updates')
    expect(s).toContain('run_id in')
    expect(s).toContain('bo_at_base_runs')
    expect(s).toContain('completed_at is not null') // in-flight runs never pruned
    expect(s).toContain('completed_at < $')
    expect(s).toContain('::timestamptz')
    // the cutoff is a bound param, never inlined into the SQL text
    expect(q.params).toContain('2026-07-05T12:00:00.000Z')
    expect(q.sql).not.toContain('2026-07-05')
  })
})
