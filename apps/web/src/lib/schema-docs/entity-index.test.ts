import { describe, expect, it } from 'vitest'
import { buildEntityPanelIndex } from './entity-index'
import type {
  SchemaEntityBase,
  SchemaEntityField,
  SchemaEntityTable,
  SchemaEntityView,
} from '../backup-engine'

const base = (over: Partial<SchemaEntityBase> = {}): SchemaEntityBase => ({
  baseId: 'appA',
  name: 'Sales',
  description: null,
  aiDescription: null,
  descriptionOverride: null,
  status: 'active',
  removedAt: null,
  ...over,
})

const table = (over: Partial<SchemaEntityTable> = {}): SchemaEntityTable => ({
  tableId: 'tblDeals',
  baseId: 'appA',
  name: 'Deals',
  recordCount: 10,
  fieldCount: 3,
  description: null,
  aiDescription: null,
  descriptionOverride: null,
  status: 'active',
  removedAt: null,
  ...over,
})

const field = (over: Partial<SchemaEntityField> = {}): SchemaEntityField => ({
  fieldId: 'fld1',
  tableId: 'tblDeals',
  baseId: 'appA',
  name: 'Name',
  type: 'singleLineText',
  isPrimary: false,
  description: null,
  aiDescription: null,
  descriptionOverride: null,
  status: 'active',
  removedAt: null,
  linkedTableId: null,
  allowsMultiple: null,
  inverseFieldId: null,
  formula: null,
  referencedFieldIds: null,
  lookupViaFieldId: null,
  lookupTargetFieldId: null,
  choices: null,
  ...over,
})

const SCHEMA = {
  bases: [base()],
  tables: [table(), table({ tableId: 'tblCompanies', name: 'Companies', fieldCount: 1 })],
  fields: [
    field({ fieldId: 'fldAmount', name: 'Amount', type: 'number' }),
    field({
      fieldId: 'fldTotal',
      name: 'Total',
      type: 'formula',
      formula: '{Amount} * 1.2',
      referencedFieldIds: ['fldAmount'],
    }),
    field({
      fieldId: 'fldCompany',
      name: 'Company',
      type: 'multipleRecordLinks',
      linkedTableId: 'tblCompanies',
      allowsMultiple: false,
      inverseFieldId: 'fldDeals',
    }),
    field({
      fieldId: 'fldDeals',
      name: 'Deals',
      tableId: 'tblCompanies',
      type: 'multipleRecordLinks',
      linkedTableId: 'tblDeals',
      allowsMultiple: true,
      inverseFieldId: 'fldCompany',
    }),
    field({
      fieldId: 'fldCompanyName',
      name: 'Company name',
      type: 'multipleLookupValues',
      lookupViaFieldId: 'fldCompany',
      lookupTargetFieldId: 'fldCName',
    }),
    field({
      fieldId: 'fldCName',
      name: 'Name',
      tableId: 'tblCompanies',
      choices: null,
    }),
    field({
      fieldId: 'fldStage',
      name: 'Stage',
      type: 'singleSelect',
      choices: ['Open', 'Won'],
      removedAt: '2026-05-14T00:00:00.000Z',
      status: 'removed',
    }),
  ],
  views: [] as SchemaEntityView[],
}

describe('buildEntityPanelIndex', () => {
  const index = buildEntityPanelIndex(SCHEMA)

  it('resolves identity + location names for a field', () => {
    const f = index['fldAmount']!
    expect(f.kind).toBe('field')
    expect(f.name).toBe('Amount')
    expect(f.tableName).toBe('Deals')
    expect(f.baseName).toBe('Sales')
    expect(f.fieldType).toBe('number')
  })

  it('carries removedAt + descriptions', () => {
    expect(index['fldStage']!.removedAt).toBe('2026-05-14T00:00:00.000Z')
    expect(index['fldStage']!.choices).toEqual(['Open', 'Won'])
  })

  it('resolves link config with names', () => {
    const f = index['fldCompany']!
    expect(f.linksTo).toEqual({ tableId: 'tblCompanies', tableName: 'Companies', allowsMultiple: false, inverseFieldName: 'Deals' })
  })

  it('resolves lookup anchoring with names', () => {
    const f = index['fldCompanyName']!
    expect(f.lookupVia).toEqual({ fieldId: 'fldCompany', fieldName: 'Company' })
    expect(f.lookupTarget).toEqual({ fieldId: 'fldCName', fieldName: 'Name', tableName: 'Companies' })
  })

  it('groups reverse references by kind', () => {
    const amount = index['fldAmount']!
    expect(amount.referencedBy.formulas).toEqual([
      { fieldId: 'fldTotal', fieldName: 'Total', tableName: 'Deals' },
    ])
    const company = index['fldCompany']!
    expect(company.referencedBy.lookups).toEqual([
      { fieldId: 'fldCompanyName', fieldName: 'Company name', tableName: 'Deals' },
    ])
    // The symmetric link pair shows under Links on both inverse fields.
    expect(company.referencedBy.links).toEqual([
      { fieldId: 'fldDeals', fieldName: 'Deals', tableName: 'Companies' },
    ])
  })

  it('lists tables linked-from on the table entity', () => {
    const companies = index['tblCompanies']!
    expect(companies.referencedBy.links).toEqual([
      { fieldId: 'fldCompany', fieldName: 'Company', tableName: 'Deals' },
    ])
  })

  it('indexes bases and tables with counts', () => {
    expect(index['appA']!.kind).toBe('base')
    expect(index['tblDeals']!.kind).toBe('table')
    expect(index['tblDeals']!.recordCount).toBe(10)
  })
})
