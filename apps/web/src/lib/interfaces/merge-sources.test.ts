// Tests for the dual-source interface merge rule (web-interfaces-source-badge).
// The canonical read contract for every web surface that renders
// bo_at_interfaces rows: one entity per airtable_entity_id, MCP authoritative
// for existence/name/composition, manual payload attached as detail.

import { describe, expect, it } from 'vitest'
import {
  mergeInterfaceSources,
  provenanceBadges,
  type InterfaceSourceRow,
} from './merge-sources'

const mcpRow = (over: Partial<InterfaceSourceRow> = {}): InterfaceSourceRow => ({
  id: 'row-mcp',
  airtableEntityId: 'pagX',
  name: 'Page A',
  type: 'page',
  status: 'active',
  submittedVia: 'mcp',
  definition: { pageType: 'list', sourceTableId: 'tbl1' },
  lastSeenAt: '2026-07-15T02:00:00.000Z',
  ...over,
})

const manualRow = (over: Partial<InterfaceSourceRow> = {}): InterfaceSourceRow => ({
  id: 'row-manual',
  airtableEntityId: 'pagX',
  name: 'Page A (documented)',
  type: 'page',
  status: 'active',
  submittedVia: 'manual_form',
  definition: { notes: 'Used by the ops team every Monday' },
  lastSeenAt: '2026-07-01T00:00:00.000Z',
  ...over,
})

describe('mergeInterfaceSources', () => {
  it('mcp-only rows pass through with a single source', () => {
    const [e] = mergeInterfaceSources([mcpRow()])
    expect(e).toMatchObject({
      airtableEntityId: 'pagX',
      name: 'Page A',
      status: 'active',
      sources: ['mcp'],
      manualDetail: null,
    })
  })

  it('manual-only rows pass through with a single source', () => {
    const [e] = mergeInterfaceSources([manualRow()])
    expect(e).toMatchObject({ name: 'Page A (documented)', sources: ['manual'] })
  })

  it('both sources merge to ONE entity: MCP name/composition, manual payload attached', () => {
    const merged = mergeInterfaceSources([manualRow(), mcpRow()])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      name: 'Page A', // MCP is naming truth
      definition: { pageType: 'list', sourceTableId: 'tbl1' },
      sources: ['mcp', 'manual'],
      manualDetail: { notes: 'Used by the ops team every Monday' },
    })
  })

  it('mcp-removed + manual-active renders as removed with manual context, never an active duplicate', () => {
    const merged = mergeInterfaceSources([mcpRow({ status: 'removed' }), manualRow()])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      status: 'removed',
      sources: ['mcp', 'manual'],
      manualDetail: { notes: 'Used by the ops team every Monday' },
    })
  })

  it('rows with a null entity id pass through ungrouped', () => {
    const merged = mergeInterfaceSources([
      manualRow({ id: 'm1', airtableEntityId: null, name: 'Sketchy legacy submission' }),
      manualRow({ id: 'm2', airtableEntityId: null, name: 'Another one' }),
    ])
    expect(merged).toHaveLength(2)
  })

  it('no surface renders the same entity twice (grouping is by entity id)', () => {
    const merged = mergeInterfaceSources([mcpRow(), manualRow(), mcpRow({ airtableEntityId: 'pagY', id: 'row-2', name: 'Other' })])
    const ids = merged.map((e) => e.airtableEntityId)
    expect(ids.filter((i) => i === 'pagX')).toHaveLength(1)
    expect(merged).toHaveLength(2)
  })
})

describe('provenanceBadges', () => {
  it('maps sources to governed Badge props (no new variants — existing soft palette)', () => {
    expect(provenanceBadges(['mcp'])).toEqual([{ label: 'Auto', variant: 'primary' }])
    expect(provenanceBadges(['manual'])).toEqual([{ label: 'Manual', variant: 'secondary' }])
    expect(provenanceBadges(['mcp', 'manual'])).toEqual([
      { label: 'Auto', variant: 'primary' },
      { label: 'Manual', variant: 'secondary' },
    ])
  })
})
