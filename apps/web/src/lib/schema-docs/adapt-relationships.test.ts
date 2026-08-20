import { describe, expect, it } from 'vitest'
import { adaptEngineRelationships } from './adapt-relationships'

describe('adaptEngineRelationships', () => {
  it('maps derived refs to endpoints and validity', () => {
    const out = adaptEngineRelationships('app1', 'Demo', {
      derived: [
        {
          id: 'd1',
          type: 'linkedRecords',
          label: 'A → B',
          refs: [
            { tableId: 'tblA', name: 'A', removed: false },
            { tableId: 'tblB', name: 'B', removed: false },
          ],
          hasRemovedHistory: false,
          valid: true,
        },
        {
          id: 'd2',
          type: 'lookups',
          label: 'skip',
          refs: [{ fieldId: 'fldX', name: 'X', removed: false }],
          hasRemovedHistory: false,
          valid: false,
        },
      ],
      syncedViews: [],
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      id: 'd1',
      type: 'linkedRecords',
      baseId: 'app1',
      baseName: 'Demo',
      a: { id: 'tblA', name: 'A', kind: 'table' },
      b: { id: 'tblB', name: 'B', kind: 'table' },
      validity: 'valid',
    })
  })

  it('maps synced views including dismissed history', () => {
    const out = adaptEngineRelationships('app1', 'Demo', {
      derived: [],
      syncedViews: [
        {
          id: 's1',
          sourceTableId: 'tblSrc',
          sourceTableName: 'Src',
          destTableId: 'tblDst',
          destTableName: 'Dst',
          status: 'inferred',
          origin: 'inferred',
          inferred: true,
          matchScore: 0.9,
        },
        {
          id: 's2',
          sourceTableId: 'tblSrc',
          sourceTableName: 'Src',
          destTableId: 'tblOld',
          destTableName: 'Old',
          status: 'dismissed',
          origin: 'inferred',
          inferred: true,
          matchScore: null,
        },
      ],
    })
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ id: 's1', type: 'syncedViews', inferred: true, validity: 'valid' })
    expect(out[1]).toMatchObject({
      id: 's2',
      inferred: false,
      validity: 'invalid',
      hasRemovedHistory: true,
    })
  })
})
