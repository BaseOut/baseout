import { describe, expect, it } from 'vitest'
import type { ChangelogEntryView } from '../backup-engine'
import type { EntityPanelInfo } from './entity-index'
import { buildNameIndex } from './changelog-view'
import {
  CHANGELOG_EXPORT_HEADER,
  ENTITY_EXPORT_HEADER,
  changelogRow,
  entityRow,
} from './export-rows'

const refs = { formulas: [], rollups: [], lookups: [], links: [] }

const info = (over: Partial<EntityPanelInfo>): EntityPanelInfo => ({
  id: 'x',
  kind: 'field',
  name: 'Amount',
  baseName: 'Core CRM',
  status: 'active',
  removedAt: null,
  airtableDescription: null,
  aiDescription: null,
  internalDescription: null,
  referencedBy: refs,
  ...over,
})

describe('entityRow', () => {
  it('maps a field to base / table / field / type / description / status', () => {
    const row = entityRow(
      info({
        kind: 'field',
        name: 'Amount',
        tableName: 'Deals',
        fieldType: 'currency',
        airtableDescription: 'Deal size',
      }),
    )
    expect(ENTITY_EXPORT_HEADER).toEqual(['base', 'table', 'field', 'type', 'description', 'status'])
    expect(row).toEqual(['Core CRM', 'Deals', 'Amount', 'currency', 'Deal size', 'active'])
  })

  it('puts a table name in the table column and its kind in type', () => {
    expect(entityRow(info({ kind: 'table', name: 'Deals', tableName: undefined }))).toEqual([
      'Core CRM',
      'Deals',
      '',
      'table',
      '',
      'active',
    ])
  })

  it('puts a base name in the base column only', () => {
    expect(entityRow(info({ kind: 'base', name: 'Core CRM' }))).toEqual([
      'Core CRM',
      '',
      '',
      'base',
      '',
      'active',
    ])
  })

  it('falls back through description sources (airtable > ai > internal)', () => {
    expect(entityRow(info({ aiDescription: 'AI text' }))[4]).toBe('AI text')
    expect(entityRow(info({ internalDescription: 'note' }))[4]).toBe('note')
  })
})

const index = buildNameIndex({
  bases: [{ baseId: 'b1', name: 'Core CRM' }],
  tables: [{ tableId: 't1', baseId: 'b1', name: 'Deals' }],
  fields: [{ fieldId: 'f1', tableId: 't1', baseId: 'b1', name: 'Amount' }],
  views: [],
})

const entry = (over: Partial<ChangelogEntryView>): ChangelogEntryView => ({
  runId: null,
  at: '2026-07-01T10:00:00Z',
  entityType: 'field',
  entityId: 'f1',
  entityName: null,
  baseId: 'b1',
  tableId: 't1',
  kind: 'modified',
  changeType: 'name',
  changeTypeName: null,
  before: 'Amt',
  after: 'Amount',
  breaksData: false,
  ...over,
})

describe('changelogRow', () => {
  it('maps a rename to at / base / table / field / changeType / summary', () => {
    expect(CHANGELOG_EXPORT_HEADER).toEqual(['at', 'base', 'table', 'field', 'changeType', 'summary'])
    expect(changelogRow(entry({}), index)).toEqual([
      '2026-07-01T10:00:00Z',
      'Core CRM',
      'Deals',
      'Amount',
      'Renamed',
      'Amt → Amount',
    ])
  })

  it('summarises removals without a before/after delta', () => {
    const row = changelogRow(
      entry({ kind: 'removed', changeType: null, entityName: 'Old Field', entityId: 'gone' }),
      index,
    )
    expect(row[3]).toBe('Old Field')
    expect(row[4]).toBe('Removed')
    expect(row[5]).toBe('field removed')
  })

  it('flags data-breaking changes in the summary', () => {
    expect(changelogRow(entry({ breaksData: true }), index)[5]).toBe('Amt → Amount (may break data)')
  })

  it('puts table entries in the table column and leaves field empty', () => {
    const row = changelogRow(entry({ entityType: 'table', entityId: 't1', tableId: null }), index)
    expect(row[2]).toBe('Deals')
    expect(row[3]).toBe('')
  })
})
