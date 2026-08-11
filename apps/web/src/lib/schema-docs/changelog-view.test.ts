import { describe, expect, it } from 'vitest'
import type { ChangelogEntryView } from '../backup-engine'
import {
  buildNameIndex,
  deriveKind,
  filterEntries,
  formatValue,
  groupByDay,
  resolveEntry,
} from './changelog-view'

const mod = (over: Partial<ChangelogEntryView> = {}): ChangelogEntryView => ({
  runId: 'run-1',
  at: '2026-07-08T12:00:00.000Z',
  entityType: 'field',
  entityId: 'fldA',
  entityName: null,
  baseId: 'appX',
  tableId: 'tblA',
  kind: 'modified',
  changeType: 'name',
  changeTypeName: null,
  before: 'Old name',
  after: 'New name',
  breaksData: false,
  ...over,
})

const removal = (over: Partial<ChangelogEntryView> = {}): ChangelogEntryView => ({
  runId: 'run-2',
  at: '2026-07-08T12:00:00.000Z',
  entityType: 'table',
  entityId: 'tblGone',
  entityName: 'Old Projects',
  baseId: 'appX',
  tableId: null,
  kind: 'removed',
  changeType: null,
  changeTypeName: null,
  before: null,
  after: null,
  breaksData: false,
  ...over,
})

const schema = {
  bases: [{ baseId: 'appX', name: 'Sales CRM' }],
  tables: [{ tableId: 'tblA', baseId: 'appX', name: 'Deals' }],
  fields: [{ fieldId: 'fldA', tableId: 'tblA', baseId: 'appX', name: 'Amount' }],
  views: [{ viewId: 'viwA', tableId: 'tblA', baseId: 'appX', name: 'Pipeline' }],
}

describe('deriveKind', () => {
  it('maps modification changeTypes to the display taxonomy', () => {
    expect(deriveKind(mod({ changeType: 'name' }))).toEqual({ key: 'renamed', label: 'Renamed' })
    expect(deriveKind(mod({ changeType: 'type' }))).toEqual({ key: 'retyped', label: 'Type changed' })
    expect(deriveKind(mod({ changeType: 'options' }))).toEqual({ key: 'config', label: 'Config' })
    expect(deriveKind(mod({ changeType: 'description' }))).toEqual({ key: 'config', label: 'Config' })
    expect(deriveKind(mod({ changeType: 'primary_field' }))).toEqual({ key: 'config', label: 'Config' })
  })

  it('maps lifecycle kinds directly', () => {
    expect(deriveKind(removal())).toEqual({ key: 'removed', label: 'Removed' })
    expect(deriveKind(mod({ kind: 'added' as ChangelogEntryView['kind'], changeType: null }))).toEqual({
      key: 'added',
      label: 'Added',
    })
  })

  it('falls back to a generic modified badge for unknown changeTypes', () => {
    expect(deriveKind(mod({ changeType: 'something_new' }))).toEqual({ key: 'config', label: 'Changed' })
  })
})

describe('buildNameIndex + resolveEntry', () => {
  const index = buildNameIndex(schema)

  it('resolves a modification entry (null entityName) from the index', () => {
    const r = resolveEntry(mod(), index)
    expect(r.entityLabel).toBe('Amount')
    expect(r.baseName).toBe('Sales CRM')
    expect(r.tableName).toBe('Deals')
  })

  it('prefers the entry-carried entityName (removals)', () => {
    const r = resolveEntry(removal(), index)
    expect(r.entityLabel).toBe('Old Projects')
    expect(r.baseName).toBe('Sales CRM')
    expect(r.tableName).toBeNull()
  })

  it('resolves views and bases too', () => {
    expect(resolveEntry(mod({ entityType: 'view', entityId: 'viwA' }), index).entityLabel).toBe('Pipeline')
    expect(resolveEntry(mod({ entityType: 'base', entityId: 'appX', tableId: null }), index).entityLabel).toBe(
      'Sales CRM',
    )
  })

  it('falls back to the entity id when unknown to the index', () => {
    const r = resolveEntry(mod({ entityId: 'fldUnknown' }), index)
    expect(r.entityLabel).toBe('fldUnknown')
  })
})

describe('groupByDay', () => {
  it('groups same-instant entries together and splits days, preserving order', () => {
    const a = mod({ at: '2026-07-08T12:00:00.000Z' })
    const b = removal({ at: '2026-07-08T12:00:00.000Z' })
    const c = mod({ at: '2026-07-05T12:00:00.000Z', entityId: 'fldA' })
    const groups = groupByDay([a, b, c])
    expect(groups).toHaveLength(2)
    expect(groups[0].entries).toEqual([a, b])
    expect(groups[1].entries).toEqual([c])
    expect(groups[0].label).toBeTruthy()
    expect(groups[0].label).not.toBe(groups[1].label)
  })

  it('collects null-dated entries under an Undated group at the end', () => {
    const dated = mod()
    const undated = mod({ at: null })
    const groups = groupByDay([dated, undated])
    expect(groups).toHaveLength(2)
    expect(groups[1].label).toBe('Undated')
    expect(groups[1].entries).toEqual([undated])
  })
})

describe('filterEntries', () => {
  const index = buildNameIndex(schema)
  const entries = [
    mod({ changeType: 'name' }),
    mod({ changeType: 'type', breaksData: true, before: 'singleLineText', after: 'number' }),
    removal(),
  ]

  it('filters by derived kind', () => {
    expect(filterEntries(entries, { kind: 'renamed', includeRemoved: true, term: '' }, index)).toEqual([
      entries[0],
    ])
    expect(filterEntries(entries, { kind: 'removed', includeRemoved: true, term: '' }, index)).toEqual([
      entries[2],
    ])
  })

  it('drops removal entries when includeRemoved is false', () => {
    const out = filterEntries(entries, { kind: null, includeRemoved: false, term: '' }, index)
    expect(out).toEqual([entries[0], entries[1]])
  })

  it('matches the search term against resolved names and values', () => {
    expect(filterEntries(entries, { kind: null, includeRemoved: true, term: 'amount' }, index)).toEqual([
      entries[0],
      entries[1],
    ])
    expect(filterEntries(entries, { kind: null, includeRemoved: true, term: 'old projects' }, index)).toEqual([
      entries[2],
    ])
    expect(filterEntries(entries, { kind: null, includeRemoved: true, term: 'new name' }, index)).toEqual([
      entries[0],
    ])
    expect(filterEntries(entries, { kind: null, includeRemoved: true, term: 'zzz' }, index)).toEqual([])
  })
})

describe('formatValue', () => {
  it('renders scalars, dashes nulls, and stringifies objects', () => {
    expect(formatValue('singleLineText')).toBe('singleLineText')
    expect(formatValue(null)).toBe('—')
    expect(formatValue(undefined)).toBe('—')
    expect(formatValue(3)).toBe('3')
    expect(formatValue({ choices: ['a'] })).toBe('{"choices":["a"]}')
  })
})
