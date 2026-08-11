// Pure selection-model logic behind the reusable Fields visibility filter
// (openspec/changes/web-field-visibility-filter). No DOM / React imports.

import { describe, expect, it } from 'vitest'
import {
  fieldIdsOfBase,
  fieldIdsOfTable,
  groupState,
  matchesQuery,
  setFieldsVisible,
  triggerLabel,
  visibleCount,
  type FvSchema,
} from './field-visibility'

const schema: FvSchema = {
  bases: [
    { baseId: 'b1', name: 'Sales' },
    { baseId: 'b2', name: 'Marketing' },
  ],
  tables: [
    { tableId: 't1', baseId: 'b1', name: 'Leads' },
    { tableId: 't2', baseId: 'b1', name: 'Accounts' },
    { tableId: 't3', baseId: 'b2', name: 'Campaigns' },
  ],
  fields: [
    { fieldId: 'f1', tableId: 't1', baseId: 'b1', name: 'Email', type: 'singleLineText' },
    { fieldId: 'f2', tableId: 't1', baseId: 'b1', name: 'Owner', type: 'singleSelect' },
    { fieldId: 'f3', tableId: 't2', baseId: 'b1', name: 'Name', type: 'singleLineText' },
    { fieldId: 'f4', tableId: 't3', baseId: 'b2', name: 'Budget', type: 'number' },
  ],
}

const sorted = (s: Set<string>) => [...s].sort()

describe('fieldIdsOf*', () => {
  it('lists field ids under a table and under a base', () => {
    expect(fieldIdsOfTable(schema, 't1').sort()).toEqual(['f1', 'f2'])
    expect(fieldIdsOfBase(schema, 'b1').sort()).toEqual(['f1', 'f2', 'f3'])
  })
})

describe('groupState', () => {
  const t1 = ['f1', 'f2']
  it('is checked when all are visible', () => {
    expect(groupState(t1, new Set(['f1', 'f2']))).toBe('checked')
  })
  it('is unchecked when none are visible', () => {
    expect(groupState(t1, new Set())).toBe('unchecked')
  })
  it('is indeterminate when some are visible', () => {
    expect(groupState(t1, new Set(['f1']))).toBe('indeterminate')
  })
  it('is unchecked for an empty group', () => {
    expect(groupState([], new Set(['f1']))).toBe('unchecked')
  })
})

describe('visibleCount', () => {
  it('counts visible fields within the group', () => {
    expect(visibleCount(['f1', 'f2'], new Set(['f1']))).toBe(1)
    expect(visibleCount(['f1', 'f2'], new Set(['f1', 'f2', 'f9']))).toBe(2)
  })
})

describe('setFieldsVisible', () => {
  it('shows: adds the ids and returns a new set without mutating the input', () => {
    const before = new Set<string>()
    const after = setFieldsVisible(before, ['f1', 'f2'], true)
    expect(sorted(after)).toEqual(['f1', 'f2'])
    expect(before.size).toBe(0) // not mutated
  })
  it('hides: removes the ids', () => {
    const after = setFieldsVisible(new Set(['f1', 'f2', 'f3']), ['f1', 'f2'], false)
    expect(sorted(after)).toEqual(['f3'])
  })
})

describe('triggerLabel', () => {
  it('formats the visible/total count', () => {
    expect(triggerLabel(24, 180)).toBe('Fields: 24 of 180')
  })
})

describe('matchesQuery', () => {
  it('returns everything for an empty query', () => {
    const m = matchesQuery(schema, '   ')
    expect(sorted(m.baseIds)).toEqual(['b1', 'b2'])
    expect(sorted(m.tableIds)).toEqual(['t1', 't2', 't3'])
    expect(sorted(m.fieldIds)).toEqual(['f1', 'f2', 'f3', 'f4'])
  })
  it('a field match reveals its ancestors and excludes siblings', () => {
    const m = matchesQuery(schema, 'email')
    expect(sorted(m.fieldIds)).toEqual(['f1'])
    expect(sorted(m.tableIds)).toEqual(['t1'])
    expect(sorted(m.baseIds)).toEqual(['b1'])
  })
  it('a table match reveals its base and all its fields', () => {
    const m = matchesQuery(schema, 'leads')
    expect(sorted(m.tableIds)).toEqual(['t1'])
    expect(sorted(m.baseIds)).toEqual(['b1'])
    expect(sorted(m.fieldIds)).toEqual(['f1', 'f2'])
  })
  it('a base match reveals its whole subtree', () => {
    const m = matchesQuery(schema, 'marketing')
    expect(sorted(m.baseIds)).toEqual(['b2'])
    expect(sorted(m.tableIds)).toEqual(['t3'])
    expect(sorted(m.fieldIds)).toEqual(['f4'])
  })
  it('is case-insensitive', () => {
    expect(sorted(matchesQuery(schema, 'EMAIL').fieldIds)).toEqual(['f1'])
  })
  it('returns empty sets when nothing matches', () => {
    const m = matchesQuery(schema, 'zzz')
    expect(m.baseIds.size).toBe(0)
    expect(m.tableIds.size).toBe(0)
    expect(m.fieldIds.size).toBe(0)
  })
})
