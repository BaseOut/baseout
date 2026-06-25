// Pure logic behind the DocsTab island (openspec/changes/shared-schema-docs §5).
// Extracted so it's unit-testable without mounting Plate / React Flow in jsdom.

import { describe, expect, it } from 'vitest'
import { addTagUnique, seedDiagramNodes, toEditorState } from './editor-logic'

describe('toEditorState', () => {
  it('normalizes a loaded document into editor state', () => {
    const e = toEditorState({
      id: 'd1',
      title: 'Conventions',
      body: [{ type: 'p', children: [{ text: 'hi' }] }],
      tags: [{ targetType: 'field', targetId: 'fld1', addedVia: 'inline', entityRemoved: true }],
      links: [{ name: 'Spec', url: 'https://x' }],
      diagrams: [{ name: 'D', state: { nodes: [{ id: 'a' }], edges: [] } }],
    } as never)
    expect(e.id).toBe('d1')
    expect(e.title).toBe('Conventions')
    expect(e.body).toEqual([{ type: 'p', children: [{ text: 'hi' }] }])
    expect(e.tags[0]).toEqual({ targetType: 'field', targetId: 'fld1', addedVia: 'inline', entityRemoved: true })
    expect(e.links[0]).toEqual({ name: 'Spec', url: 'https://x' })
    expect(e.diagrams[0]!.name).toBe('D')
  })

  it('falls back to safe defaults for null/missing fields', () => {
    const e = toEditorState({ id: 'd2', title: 'Empty', body: null, tags: null, links: null, diagrams: null } as never)
    expect(Array.isArray(e.body)).toBe(true)
    expect(e.tags).toEqual([])
    expect(e.links).toEqual([])
    expect(e.diagrams).toEqual([])
  })

  it('defaults a missing tag addedVia to manual and link name to empty', () => {
    const e = toEditorState({
      id: 'd3',
      title: 'T',
      body: [],
      tags: [{ targetType: 'table', targetId: 'tbl1' }],
      links: [{ url: 'https://y' }],
      diagrams: [],
    } as never)
    expect(e.tags[0]!.addedVia).toBe('manual')
    expect(e.links[0]!.name).toBe('')
  })
})

describe('addTagUnique', () => {
  const tags = [{ targetType: 'field' as const, targetId: 'fld1', addedVia: 'manual' as const }]

  it('appends a new entity tag', () => {
    const out = addTagUnique(tags, 'table', 'tbl1')
    expect(out).toHaveLength(2)
    expect(out[1]).toEqual({ targetType: 'table', targetId: 'tbl1', addedVia: 'manual' })
  })

  it('is a no-op when the entity is already tagged', () => {
    const out = addTagUnique(tags, 'field', 'fld1')
    expect(out).toEqual(tags)
  })
})

describe('seedDiagramNodes', () => {
  it('creates a node per tagged table, labeled via the lookup', () => {
    const tags = [
      { targetType: 'table' as const, targetId: 'tblA', addedVia: 'manual' as const },
      { targetType: 'field' as const, targetId: 'fld1', addedVia: 'manual' as const },
      { targetType: 'table' as const, targetId: 'tblB', addedVia: 'manual' as const },
    ]
    const nodes = seedDiagramNodes(tags, (key) => (key === 'table:tblA' ? 'Deals' : key))
    expect(nodes).toHaveLength(2) // only tables
    expect(nodes[0]).toMatchObject({ id: 'tblA', data: { label: 'Deals' } })
    expect(nodes[1]).toMatchObject({ id: 'tblB', data: { label: 'table:tblB' } })
    expect(typeof nodes[0]!.position.x).toBe('number')
  })
})
