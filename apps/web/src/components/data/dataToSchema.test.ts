import { describe, it, expect } from 'vitest'
import {
  buildDataDocsEntities,
  dataBasesToHealthBases,
  filterRecordsWithParentTable,
} from './dataToSchema'
import type { DataBase, DataTable, DataRecord, SavedView } from './dataTypes'

const bases: DataBase[] = [
  { id: 'app1', name: 'Ops' },
  { id: 'app2', name: 'CRM' },
]

const tables: DataTable[] = [
  {
    id: 'tbl1',
    baseId: 'app1',
    name: 'Tasks',
    approxRecordCount: 10,
    fields: [
      { id: 'fld1', name: 'Name', type: 'singleLineText' },
      { id: 'fld2', name: 'Status', type: 'singleSelect' },
    ],
  },
]

const records: DataRecord[] = [
  { id: 'rec1', tableId: 'tbl1', primary: 'Alpha', cells: {} },
  { id: 'rec-orphan', tableId: 'tbl-missing', primary: 'Ghost', cells: {} },
]

const views: SavedView[] = [
  { id: 'view1', name: 'Active', tableId: 'tbl1', pinned: true },
]

describe('filterRecordsWithParentTable', () => {
  it('keeps records whose table exists and drops orphans without throwing', () => {
    expect(filterRecordsWithParentTable(records, tables)).toEqual([records[0]])
    expect(filterRecordsWithParentTable([], tables)).toEqual([])
    expect(filterRecordsWithParentTable(records, [])).toEqual([])
  })
})

describe('buildDataDocsEntities', () => {
  it('returns empty for empty inputs', () => {
    expect(buildDataDocsEntities([], [])).toEqual([])
  })

  it('maps bases, tables, and fields', () => {
    expect(buildDataDocsEntities(bases, tables)).toEqual([
      { type: 'base', id: 'app1', label: 'Ops' },
      { type: 'base', id: 'app2', label: 'CRM' },
      { type: 'table', id: 'tbl1', label: 'Tasks' },
      { type: 'field', id: 'fld1', label: 'Name' },
      { type: 'field', id: 'fld2', label: 'Status' },
    ])
  })

  it('includes saved Browse views when provided', () => {
    const entities = buildDataDocsEntities(bases, tables, { views })
    expect(entities.filter((e) => e.type === 'view')).toEqual([
      { type: 'view', id: 'view1', label: 'Active' },
    ])
  })

  it('accepts orphan records without throwing and does not emit record entities', () => {
    const entities = buildDataDocsEntities(bases, tables, { records })
    expect(entities.some((e) => e.id === 'rec-orphan')).toBe(false)
    expect(entities.some((e) => e.id === 'rec1')).toBe(false)
  })
})

describe('dataBasesToHealthBases', () => {
  it('maps to ChatTab healthBases shape', () => {
    expect(dataBasesToHealthBases(bases)).toEqual([
      { baseId: 'app1', name: 'Ops' },
      { baseId: 'app2', name: 'CRM' },
    ])
  })

  it('returns empty for empty bases', () => {
    expect(dataBasesToHealthBases([])).toEqual([])
  })
})
