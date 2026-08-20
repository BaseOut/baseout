import { describe, expect, it } from 'vitest'
import { adaptChangelogEntries } from './adapt-changelog'
import { adaptHealthOverview } from './adapt-health'
import type { ChangelogEntryView } from '../backup-engine'

const schema = {
  bases: [{ baseId: 'app1', name: 'Demo' }],
  tables: [{ tableId: 'tbl1', baseId: 'app1', name: 'Deals' }],
  fields: [{ fieldId: 'fld1', tableId: 'tbl1', baseId: 'app1', name: 'Amount' }],
  views: [] as { viewId: string; tableId: string; baseId: string; name: string }[],
}

describe('adaptChangelogEntries', () => {
  it('maps renamed field with summary and tip type', () => {
    const entries: ChangelogEntryView[] = [
      {
        runId: 'run1',
        at: '2026-08-01T12:00:00.000Z',
        entityType: 'field',
        entityId: 'fld1',
        entityName: null,
        baseId: 'app1',
        tableId: 'tbl1',
        kind: 'modified',
        changeType: 'name',
        changeTypeName: null,
        before: 'Old',
        after: 'Amount',
        breaksData: false,
      },
    ]
    const out = adaptChangelogEntries(entries, schema)
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('renamed')
    expect(out[0].base).toBe('Demo')
    expect(out[0].table).toBe('Deals')
    expect(out[0].field).toBe('Amount')
    expect(out[0].summary).toContain('Renamed')
    expect(out[0].before).toBe('Old')
    expect(out[0].after).toBe('Amount')
  })

  it('maps retyped → typed and breaksData → warning', () => {
    const entries: ChangelogEntryView[] = [
      {
        runId: 'run1',
        at: '2026-08-01T12:00:00.000Z',
        entityType: 'field',
        entityId: 'fld1',
        entityName: null,
        baseId: 'app1',
        tableId: 'tbl1',
        kind: 'modified',
        changeType: 'type',
        changeTypeName: null,
        before: 'number',
        after: 'currency',
        breaksData: true,
      },
    ]
    const out = adaptChangelogEntries(entries, schema)
    expect(out[0].type).toBe('typed')
    expect(out[0].warning).toMatch(/invalidated/)
  })
})

describe('adaptHealthOverview', () => {
  it('maps yellow→amber and medium→med', () => {
    const out = adaptHealthOverview('app1', 'Demo', {
      grade: { score: 72, band: 'yellow' },
      metrics: [
        {
          ruleId: 'r1',
          name: 'Descriptions',
          weight: 40,
          severity: 'medium',
          entityTier: 'table,field',
          score: 70,
          lastGeneratedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      issues: [
        {
          ruleId: 'r1',
          severity: 'medium',
          tableId: 'tbl1',
          fieldId: null,
          message: 'Missing descriptions',
          airtableDeeplink: 'https://airtable.com/app1',
        },
      ],
    })
    expect(out.band).toBe('amber')
    expect(out.score).toBe(72)
    expect(out.metrics[0].tiers).toEqual(['Table', 'Field'])
    expect(out.metrics[0].ruleId).toBe('r1')
    expect(out.issues[0].severity).toBe('med')
    expect(out.issues[0].airtableUrl).toContain('airtable.com')
    expect(out.insights).toEqual([])
  })
})
