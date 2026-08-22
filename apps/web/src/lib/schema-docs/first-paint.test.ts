import { describe, expect, it } from 'vitest'
import { loadSchemaFirstPaint } from './first-paint'

describe('loadSchemaFirstPaint', () => {
  it('loads getSchema only — no per-base relationships, changelog, or health', async () => {
    const calls: string[] = []
    const engine = {
      getSchema: async () => {
        calls.push('schema')
        return {
          ok: true as const,
          bases: [
            {
              baseId: 'app1',
              name: 'CRM',
              description: null,
              aiDescription: null,
              descriptionOverride: null,
              status: 'active' as const,
              removedAt: null,
            },
          ],
          tables: [],
          fields: [],
          views: [],
        }
      },
      listDocuments: async () => {
        calls.push('docs')
        return { ok: true as const, documents: [] }
      },
      getRelationships: async () => {
        calls.push('rel')
        return { ok: true as const, derived: [], syncedViews: [] }
      },
      getSchemaChangelog: async () => {
        calls.push('changelog')
        return { ok: true as const, entries: [] }
      },
      getHealthOverview: async () => {
        calls.push('health')
        return { ok: true as const, grade: null, metrics: [], issues: [] }
      },
    }

    const out = await loadSchemaFirstPaint(engine, 'space-1')
    expect(calls).toEqual(['schema'])
    expect(out.schema.bases).toHaveLength(1)
    expect(out.docs).toEqual([])
  })
})
