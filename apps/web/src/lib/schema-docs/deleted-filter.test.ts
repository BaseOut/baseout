// Pure logic behind the Browse "Include deleted" filter
// (openspec/changes/web-deleted-items-filter). No DOM / Astro imports, so it's
// unit-testable in plain Node.

import { describe, expect, it } from 'vitest'
import { countDeleted, isRemoved, removalNote } from './deleted-filter'

describe('isRemoved', () => {
  it('is true only for removed', () => {
    expect(isRemoved('removed')).toBe(true)
  })
  it('is false for active and unknown (unknown is not deleted)', () => {
    expect(isRemoved('active')).toBe(false)
    expect(isRemoved('unknown')).toBe(false)
  })
  it('is false for null/undefined/unexpected', () => {
    expect(isRemoved(null)).toBe(false)
    expect(isRemoved(undefined)).toBe(false)
    expect(isRemoved('')).toBe(false)
  })
})

describe('countDeleted', () => {
  const schema = {
    bases: [{ status: 'active' }, { status: 'removed' }],
    tables: [{ status: 'removed' }, { status: 'unknown' }, { status: 'active' }],
    fields: [{ status: 'removed' }, { status: 'removed' }],
    views: [{ status: 'active' }],
  }

  it('counts removed across all four entity levels', () => {
    expect(countDeleted(schema)).toBe(4) // 1 base + 1 table + 2 fields
  })

  it('excludes unknown and active', () => {
    expect(
      countDeleted({
        bases: [{ status: 'unknown' }],
        tables: [{ status: 'active' }],
        fields: [{ status: 'unknown' }],
        views: [{ status: 'active' }],
      }),
    ).toBe(0)
  })

  it('is zero for a clean schema', () => {
    expect(countDeleted({ bases: [], tables: [], fields: [], views: [] })).toBe(0)
  })
})

describe('removalNote', () => {
  it('omits the date when none is available', () => {
    expect(removalNote()).toBe('no longer in Airtable')
    expect(removalNote(null)).toBe('no longer in Airtable')
  })
  it('includes the date when available', () => {
    expect(removalNote('2026-06-01')).toBe('no longer in Airtable since 2026-06-01')
  })
})
