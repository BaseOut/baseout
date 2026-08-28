// preset-serialize (web-saved-views D1) — the extracted Data Browse wire
// format. Pins the behaviors the inline script relied on: round-trip fidelity,
// stale-field drops (leaf dropped, tree kept), synthetic-column validity,
// degrade-to-default parsing, and the diff-based config equality.
import { describe, expect, it } from 'vitest'
import {
  serializeConfig,
  deserializeConfig,
  deserializeNode,
  configEq,
  setEq,
  treeEq,
  type LiveConfig,
  type SerializedConfig,
} from './preset-serialize'

type F = { id: string; name: string }
const table = { fields: [{ id: 'f1', name: 'Name' }, { id: 'f2', name: 'Age' }] as F[] }
const REC = '__recid__'

const live = (over: Partial<LiveConfig<F>> = {}): LiveConfig<F> => ({
  tableId: 'tbl1',
  hiddenCols: new Set(['f2']),
  filterTree: {
    kind: 'group',
    conjunction: 'and',
    children: [
      { kind: 'cond', field: table.fields[0]!, op: 'contains', val: 'x' },
      { kind: 'group', conjunction: 'or', children: [{ kind: 'cond', field: table.fields[1]!, op: 'gt', val: '3', val2: '9' }] },
    ],
  },
  sortField: 'f1',
  sortDir: -1,
  query: 'hello',
  showRecId: true,
  colOrder: [REC, 'f1', 'f2'],
  commentFilter: 'with',
  ...over,
})

describe('round-trip', () => {
  it('serialize → deserialize reproduces an equal config (fields re-resolved from the table)', () => {
    const a = live()
    const b = deserializeConfig(serializeConfig(a), table, [REC])
    expect(configEq(a, b)).toBe(true)
    // Re-resolved field is the table's live instance, not a detached clone.
    const leaf = b.filterTree.children[0]!
    expect(leaf.kind === 'cond' && leaf.field).toBe(table.fields[0])
  })
})

describe('staleness guards', () => {
  it('drops a stale-field leaf but keeps siblings, nesting, and the group', () => {
    const sc = serializeConfig(live())
    const shrunk = { fields: [table.fields[1]!] } // f1 removed
    const out = deserializeConfig(sc, shrunk, [REC])
    expect(out.filterTree.children).toHaveLength(1) // f1 leaf dropped
    expect(out.filterTree.children[0]!.kind).toBe('group') // nested group survives
    expect(out.sortField).toBe('') // stale sort field cleared
    expect([...out.hiddenCols]).toEqual(['f2'])
    expect(out.colOrder).toEqual([REC, 'f2'])
  })

  it('a group is never dropped even when every child is stale', () => {
    const n = deserializeNode({ kind: 'group', conjunction: 'or', children: [{ kind: 'cond', fieldId: 'ghost', op: 'eq', val: '' }] }, table)
    expect(n).toEqual({ kind: 'group', conjunction: 'or', children: [] })
  })

  it('synthetic column ids stay valid only when declared', () => {
    const sc = serializeConfig(live())
    expect(deserializeConfig(sc, table).colOrder).toEqual(['f1', 'f2']) // no REC declared → dropped
  })
})

describe('degrade-to-default parsing', () => {
  it('malformed commentFilter/sortDir/missing arrays degrade, never throw', () => {
    const sc = { tableId: 't', filterTree: undefined, sortDir: 5, commentFilter: 'nope' } as unknown as SerializedConfig
    const out = deserializeConfig(sc, table)
    expect(out.commentFilter).toBe('all')
    expect(out.sortDir).toBe(1)
    expect(out.hiddenCols.size).toBe(0)
    expect(out.filterTree).toEqual({ kind: 'group', conjunction: 'and', children: [] })
  })
})

describe('configEq — dirty by diff', () => {
  it('typing then deleting a character reads CLEAN again', () => {
    const a = live()
    const b = live({ query: 'hello!' })
    expect(configEq(a, b)).toBe(false)
    b.query = 'hello'
    expect(configEq(a, b)).toBe(true)
  })
  it('hiddenCols is a set; colOrder is a sequence', () => {
    expect(setEq(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true)
    expect(configEq(live({ colOrder: ['f1', REC, 'f2'] }), live())).toBe(false)
  })
  it('treeEq diffs op/val/val2/conjunction/shape', () => {
    const a = live().filterTree
    const b = live().filterTree
    expect(treeEq(a, b)).toBe(true)
    ;(b.children[0] as { val: string }).val = 'y'
    expect(treeEq(a, b)).toBe(false)
  })
})
