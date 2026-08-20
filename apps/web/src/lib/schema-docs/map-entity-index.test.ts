import { describe, expect, it } from 'vitest'
import {
  mapDocSummariesToSchemaDocs,
  mapEngineToCanvasTables,
  mapEngineToEntityIndex,
} from './map-entity-index'
import type {
  SchemaEntityBase,
  SchemaEntityField,
  SchemaEntityTable,
} from '../backup-engine'

const base = (over: Partial<SchemaEntityBase> = {}): SchemaEntityBase => ({
  baseId: 'appA',
  name: 'CRM',
  description: 'Airtable base desc',
  aiDescription: null,
  descriptionOverride: 'Internal base note',
  status: 'active',
  removedAt: null,
  ...over,
})

const table = (over: Partial<SchemaEntityTable> = {}): SchemaEntityTable => ({
  tableId: 'tbl1',
  baseId: 'appA',
  name: 'Deals',
  recordCount: 10,
  fieldCount: 2,
  description: 'Table AT desc',
  aiDescription: null,
  descriptionOverride: 'Internal table',
  status: 'active',
  removedAt: null,
  ...over,
})

const field = (over: Partial<SchemaEntityField> = {}): SchemaEntityField => ({
  fieldId: 'fld1',
  tableId: 'tbl1',
  baseId: 'appA',
  name: 'Stage',
  type: 'singleSelect',
  isPrimary: false,
  description: 'Airtable field desc',
  aiDescription: 'AI note',
  descriptionOverride: 'Internal field',
  status: 'active',
  removedAt: null,
  linkedTableId: null,
  allowsMultiple: null,
  inverseFieldId: null,
  formula: null,
  referencedFieldIds: null,
  lookupViaFieldId: null,
  lookupTargetFieldId: null,
  choices: ['Open', 'Won'],
  ...over,
})

describe('mapEngineToCanvasTables', () => {
  it('maps description → airtableDescription and descriptionOverride → userDescription', () => {
    const tables = mapEngineToCanvasTables({
      bases: [base()],
      tables: [table()],
      fields: [field()],
    })
    expect(tables).toHaveLength(1)
    expect(tables[0].airtableDescription).toBe('Table AT desc')
    expect(tables[0].userDescription).toBe('Internal table')
    expect(tables[0].fields[0].airtableDescription).toBe('Airtable field desc')
    expect(tables[0].fields[0].userDescription).toBe('Internal field')
    expect(tables[0].fields[0].description).toBe('AI note')
    expect((tables[0].fields[0] as { airtableDraft?: string }).airtableDraft).toBeUndefined()
  })
})

describe('mapEngineToEntityIndex', () => {
  it('builds base/table/field entities with read-only Airtable + Internal notes', () => {
    const index = mapEngineToEntityIndex({
      bases: [base()],
      tables: [table()],
      fields: [field()],
    })
    const b = index.find((e) => e.id === 'appA')
    const t = index.find((e) => e.id === 'tbl1')
    const f = index.find((e) => e.id === 'fld1')
    expect(b?.kind).toBe('base')
    expect(b?.airtableDescription).toBe('Airtable base desc')
    expect(b?.userDescription).toBe('Internal base note')
    expect(t?.airtableDescription).toBe('Table AT desc')
    expect(t?.userDescription).toBe('Internal table')
    expect(f?.airtableDescription).toBe('Airtable field desc')
    expect(f?.userDescription).toBe('Internal field')
    expect(f?.aiDescription).toBe('AI note')
    expect((f as { airtableDraft?: string } | undefined)?.airtableDraft).toBeUndefined()
  })

  it('returns empty index for empty schema', () => {
    expect(mapEngineToEntityIndex({ bases: [], tables: [], fields: [] })).toEqual([])
  })
})

describe('mapDocSummariesToSchemaDocs', () => {
  it('maps titles for the Documentation section', () => {
    const docs = mapDocSummariesToSchemaDocs([
      {
        id: 'd1',
        title: 'Deal stages',
        excerpt: 'How we stage',
        createdByUserId: null,
        createdAt: null,
        updatedAt: '2026-08-01T00:00:00Z',
        tagCount: 1,
      },
    ])
    expect(docs[0]).toMatchObject({ id: 'd1', title: 'Deal stages', entityIds: [] })
  })
})
