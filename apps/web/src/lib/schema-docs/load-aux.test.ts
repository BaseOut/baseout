import { describe, expect, it } from 'vitest'
import { loadSchemaAuxTabs } from './load-aux'

describe('loadSchemaAuxTabs', () => {
  it('fans out one relationships + changelog + health call per base', async () => {
    const rel: string[] = []
    const cl: string[] = []
    const hl: string[] = []
    const engine = {
      getRelationships: async (_space: string, baseId: string) => {
        rel.push(baseId)
        return { ok: true as const, derived: [], syncedViews: [] }
      },
      getSchemaChangelog: async (_space: string, baseId: string) => {
        cl.push(baseId)
        return { ok: true as const, entries: [] }
      },
      getHealthOverview: async (_space: string, baseId: string) => {
        hl.push(baseId)
        return { ok: true as const, grade: null, metrics: [], issues: [] }
      },
    }
    const bases = [
      { baseId: 'app1', name: 'A' },
      { baseId: 'app2', name: 'B' },
    ]
    await loadSchemaAuxTabs(engine, 'space-1', bases, {
      bases: bases.map((b) => ({ baseId: b.baseId, name: b.name })),
      tables: [],
      fields: [],
      views: [],
    })
    expect(rel.sort()).toEqual(['app1', 'app2'])
    expect(cl.sort()).toEqual(['app1', 'app2'])
    expect(hl.sort()).toEqual(['app1', 'app2'])
  })
})
