import { describe, it, expect } from 'vitest'
import {
  mapSchemaToData,
  cellRaw,
  mapRecords,
  mapRunTotals,
  mapChangelogRows,
  mapComments,
  mapMediaAssets,
} from './map'
import type {
  DataRecordRow,
  DataChangelogRunRollup,
  DataChangelogChangeRow,
  DataCommentRow,
  MediaAssetView,
} from './engine-shapes'

function schemaOk() {
  return {
    ok: true as const,
    bases: [
      { baseId: 'appA', name: 'CRM', description: null, aiDescription: null, descriptionOverride: null, status: 'active', removedAt: null },
      { baseId: 'appGone', name: 'Old', description: null, aiDescription: null, descriptionOverride: null, status: 'active', removedAt: '2026-01-01T00:00:00Z' },
    ],
    tables: [
      { tableId: 'tbl1', baseId: 'appA', name: 'Deals', recordCount: 42, fieldCount: 2, description: null, aiDescription: null, descriptionOverride: null, status: 'active', removedAt: null },
    ],
    fields: [
      { fieldId: 'fldName', tableId: 'tbl1', baseId: 'appA', name: 'Name', type: 'singleLineText', isPrimary: true, description: null, aiDescription: null, descriptionOverride: null, status: 'active', removedAt: null, linkedTableId: null, allowsMultiple: null, inverseFieldId: null, formula: null, referencedFieldIds: null, lookupViaFieldId: null, lookupTargetFieldId: null, choices: null },
      { fieldId: 'fldAmt', tableId: 'tbl1', baseId: 'appA', name: 'Amount', type: 'currency', isPrimary: false, description: null, aiDescription: null, descriptionOverride: null, status: 'active', removedAt: null, linkedTableId: null, allowsMultiple: null, inverseFieldId: null, formula: null, referencedFieldIds: null, lookupViaFieldId: null, lookupTargetFieldId: null, choices: null },
      { fieldId: 'fldDead', tableId: 'tbl1', baseId: 'appA', name: 'Removed', type: 'singleLineText', isPrimary: false, description: null, aiDescription: null, descriptionOverride: null, status: 'active', removedAt: '2026-02-01T00:00:00Z', linkedTableId: null, allowsMultiple: null, inverseFieldId: null, formula: null, referencedFieldIds: null, lookupViaFieldId: null, lookupTargetFieldId: null, choices: null },
    ],
    views: [],
  }
}

describe('mapSchemaToData', () => {
  it('maps active bases/tables and finds the primary field, dropping removed entities', () => {
    const m = mapSchemaToData(schemaOk())
    expect(m.bases).toEqual([{ id: 'appA', name: 'CRM' }])
    expect(m.tables).toHaveLength(1)
    expect(m.tables[0]).toMatchObject({ id: 'tbl1', baseId: 'appA', name: 'Deals', approxRecordCount: 42 })
    // fldDead is removed → excluded
    expect(m.tables[0].fields.map((f) => f.id)).toEqual(['fldName', 'fldAmt'])
    expect(m.primaryByTable.tbl1).toBe('fldName')
  })
})

describe('cellRaw', () => {
  it('stringifies primitives, blanks nullish, JSON-encodes objects', () => {
    expect(cellRaw(null)).toBe('')
    expect(cellRaw(undefined)).toBe('')
    expect(cellRaw('hi')).toBe('hi')
    expect(cellRaw(3)).toBe('3')
    expect(cellRaw(true)).toBe('true')
    expect(cellRaw([{ id: 'a' }])).toBe('[{"id":"a"}]')
  })
})

describe('mapRecords', () => {
  it('keys cells by field id, uses the primary field for display, flags empties', () => {
    const rows: DataRecordRow[] = [
      { recordId: 'rec1', createdTime: null, modifiedTime: null, status: 'active', fields: { fldName: 'Acme', fldAmt: 100, fldEmpty: '' } },
    ]
    const [rec] = mapRecords(rows, 'tbl1', 'fldName')
    expect(rec.id).toBe('rec1')
    expect(rec.tableId).toBe('tbl1')
    expect(rec.primary).toBe('Acme')
    expect(rec.cells.fldAmt).toEqual({ raw: '100' })
    expect(rec.cells.fldEmpty).toEqual({ raw: '', empty: true })
  })
  it('falls back to recordId when the primary field is missing', () => {
    const [rec] = mapRecords(
      [{ recordId: 'rec9', createdTime: null, modifiedTime: null, status: 'active', fields: {} }],
      'tbl1',
      undefined,
    )
    expect(rec.primary).toBe('rec9')
  })
})

describe('mapRunTotals', () => {
  it('keys true counts by run id', () => {
    const runs: DataChangelogRunRollup[] = [
      { runId: 'run1', startedAt: null, completedAt: null, createdCount: 5, updatedCount: 3, deletedCount: 1 },
    ]
    expect(mapRunTotals(runs)).toEqual({ run1: { created: 5, updated: 3, deleted: 1 } })
  })
})

describe('mapChangelogRows', () => {
  it('maps rows to entries, using recordId as primary and changedFieldIds length as fieldCount', () => {
    const rows: DataChangelogChangeRow[] = [
      { recordId: 'rec1', tableId: 'tbl1', baseId: 'appA', changeType: 'updated', createdTime: null, modifiedTime: '2026-06-01T10:00:00Z', status: 'active', changedFieldIds: ['a', 'b'] },
    ]
    const [e] = mapChangelogRows(rows, 'run1', '2026-06-01T00:00:00Z')
    expect(e).toMatchObject({ id: 'run1:updated:rec1', recordId: 'rec1', primary: 'rec1', tableId: 'tbl1', runId: 'run1', type: 'updated', at: '2026-06-01T10:00:00Z', fieldCount: 2 })
  })
  it('falls back to the run timestamp when the row carries no times', () => {
    const [e] = mapChangelogRows(
      [{ recordId: 'r', tableId: null, baseId: null, changeType: 'created', createdTime: null, modifiedTime: null, status: null }],
      'run2',
      '2026-06-02T00:00:00Z',
    )
    expect(e.at).toBe('2026-06-02T00:00:00Z')
    expect(e.tableId).toBe('')
    expect(e.fieldCount).toBeUndefined()
  })
})

describe('mapMediaAssets', () => {
  const view: MediaAssetView = {
    id: 'ast1',
    checksum: 'sha1',
    contentType: 'image/png',
    contentClass: 'image',
    sizeBytes: 2048,
    storageKind: 'r2_managed',
    storageProvider: null,
    storageRef: 'r2/key',
    thumbnailStatus: 'ready',
    thumbnailKey: 'thumb/key',
    firstSeenAt: '2026-06-01T00:00:00Z',
    lastSeenAt: '2026-06-02T00:00:00Z',
    refs: [{ attachmentId: 'att1', baseId: 'appA', tableId: 'tbl1', recordId: 'rec1', fieldId: 'fldFile', filename: 'logo.png', status: 'active' }],
  }
  it('maps a Baseout-stored field attachment', () => {
    const [a] = mapMediaAssets([view])
    expect(a).toMatchObject({
      id: 'ast1',
      kind: 'image',
      filename: 'logo.png',
      type: 'image/png',
      size: 2048,
      checksum: 'sha1',
      capturedAt: '2026-06-01T00:00:00Z',
      lastSeenAt: '2026-06-02T00:00:00Z',
      sourceKind: 'field',
    })
    expect(a.storage).toEqual({ baseout: true })
    expect(a.source).toEqual({ baseId: 'appA', tableId: 'tbl1', fieldId: 'fldFile', recordId: 'rec1' })
    // thumbnailKey is a storage key, not a URL → thumbUrl stays absent (honesty note)
    expect(a.thumbUrl).toBeUndefined()
  })
  it('maps a BYOS/destination-stored asset with a recognized provider', () => {
    const [a] = mapMediaAssets([
      { ...view, id: 'ast2', storageKind: 'destination', storageProvider: 'google_drive', contentClass: 'weird' },
    ])
    expect(a.kind).toBe('other')
    expect(a.storage).toEqual({ baseout: false, provider: 'google_drive' })
  })
})

describe('mapComments', () => {
  const row: DataCommentRow = {
    commentId: 'com1',
    recordId: 'rec1',
    tableId: 'tbl1',
    baseId: 'appA',
    author: { id: 'usr1', name: 'Sam Silva', email: 's@example.com' },
    text: 'hello @[usr2]',
    createdTime: '2026-08-01T10:00:00.000Z',
    lastUpdatedTime: null,
    lastSeenAt: '2026-08-05T00:00:00.000Z',
    status: 'active',
    parentCommentId: 'com0',
    mentioned: { usr2: { id: 'usr2', type: 'user', displayName: 'Ana', email: 'a@example.com' } },
  }

  it('maps identity, timestamps, author and threading', () => {
    const [c] = mapComments([row])
    expect(c.id).toBe('com1')
    expect(c.recordId).toBe('rec1')
    expect(c.tableId).toBe('tbl1')
    expect(c.text).toBe('hello @[usr2]')
    expect(c.createdAt).toBe('2026-08-01T10:00:00.000Z')
    expect(c.lastUpdatedAt).toBeNull()
    expect(c.lastSeenAt).toBe('2026-08-05T00:00:00.000Z')
    expect(c.author).toEqual({ id: 'usr1', name: 'Sam Silva', email: 's@example.com' })
    expect(c.parentCommentId).toBe('com0')
    expect(c.mentioned).toEqual({ usr2: { id: 'usr2', type: 'user', displayName: 'Ana', email: 'a@example.com' } })
  })

  it('degrades a withheld author to a nameless id (never a raw key on screen)', () => {
    const [c] = mapComments([{ ...row, author: null, mentioned: null, parentCommentId: null }])
    expect(c.author).toEqual({ id: '' })
    expect(c.mentioned).toBeUndefined()
    expect(c.parentCommentId).toBeUndefined()
  })

  it('coerces an unknown mention type to user and drops malformed entries', () => {
    const [c] = mapComments([
      { ...row, mentioned: { a: { id: 'a', type: 'weird' }, b: 'not-an-object' } },
    ])
    expect(c.mentioned).toEqual({ a: { id: 'a', type: 'user' } })
  })

  it('falls back to lastSeenAt when the captured createdTime is null', () => {
    const [c] = mapComments([{ ...row, createdTime: null }])
    expect(c.createdAt).toBe('2026-08-05T00:00:00.000Z')
    expect(c.lastSeenAt).toBe('2026-08-05T00:00:00.000Z')
  })

  it('does not surface attachments or reactions in this slice (honesty note)', () => {
    const [c] = mapComments([row])
    expect(c.attachments).toBeUndefined()
    expect(c.reactions).toBeUndefined()
  })
})
