/**
 * Data Browse preset wire format + config equality (web-saved-views D1).
 *
 * EXTRACTED VERBATIM from the DataBrowse.astro inline script's persistence
 * region so the shape is (a) unit-testable and (b) shared: this is the exact
 * `config` JSON that `server-saved-views` stores opaquely in bo_at_saved_views
 * and that api-views-tools exposes over MCP. Behavior is unchanged:
 *  - a condition serializes its fieldId only; deserialize re-resolves the live
 *    Field from the CURRENT table and DROPS stale leaves (never throws, never
 *    flattens) while groups always survive;
 *  - hiddenCols/colOrder entries whose field no longer exists are dropped;
 *  - commentFilter degrades to 'all'; sortDir to 1;
 *  - configEq diffs every facet — dirty is computed, never sticky (Dan
 *    2026-07-23), and colOrder joins on '\0' (the ESCAPE, never the raw byte —
 *    X-CENSUS-INSTRUMENT-NUL-BYTE, fixed 2026-08-14).
 *
 * Generic over the caller's Field type (structurally `{ id: string }`) so the
 * inline script's richer Field flows through untouched.
 */

export type CommentFilter = 'all' | 'with' | 'without';

// ── Wire shapes (plain JSON — localStorage, server rows, MCP payloads) ──
export type SerializedCond = { kind: 'cond'; fieldId: string; op: string; val: string; val2?: string };
export type SerializedGroup = { kind: 'group'; conjunction: 'and' | 'or'; children: SerializedNode[] };
export type SerializedNode = SerializedCond | SerializedGroup;
export type SerializedConfig = {
  tableId: string;
  hiddenCols: string[];
  filterTree: SerializedGroup;
  sortField: string;
  sortDir: number;
  query: string;
  showRecId: boolean;
  colOrder: string[];
  commentFilter?: CommentFilter;
};
/** A runtime preset's full persisted state. `baseline` exists once Saved. */
export type SerializedPreset = {
  id: string;
  name: string;
  tableId: string;
  pinned: boolean;
  temporary: boolean;
  groupId?: string;
  saved: boolean;
  config: SerializedConfig;
  baseline?: SerializedConfig;
};

// ── Live shapes (structural — the component's Cond/FGroup/Baseline match) ──
export type LiveCond<F extends { id: string }> = { kind: 'cond'; field: F; op: string; val: string; val2?: string };
export type LiveGroup<F extends { id: string }> = { kind: 'group'; conjunction: 'and' | 'or'; children: LiveNode<F>[] };
export type LiveNode<F extends { id: string }> = LiveCond<F> | LiveGroup<F>;
export type LiveConfig<F extends { id: string }> = {
  tableId: string;
  hiddenCols: Set<string>;
  filterTree: LiveGroup<F>;
  sortField: string;
  sortDir: number;
  query: string;
  showRecId: boolean;
  colOrder: string[];
  commentFilter: CommentFilter;
};

const emptyGroup = <F extends { id: string }>(): LiveGroup<F> => ({ kind: 'group', conjunction: 'and', children: [] });

export function serializeNode<F extends { id: string }>(n: LiveNode<F>): SerializedNode {
  return n.kind === 'group'
    ? { kind: 'group', conjunction: n.conjunction, children: n.children.map(serializeNode) }
    : { kind: 'cond', fieldId: n.field.id, op: n.op, val: n.val, val2: n.val2 };
}

export function deserializeNode<F extends { id: string }>(n: SerializedNode, t: { fields: F[] }): LiveNode<F> | null {
  if (n.kind === 'group') {
    return {
      kind: 'group',
      conjunction: n.conjunction,
      children: n.children.map((c) => deserializeNode(c, t)).filter((c): c is LiveNode<F> => c !== null),
    };
  }
  const field = t.fields.find((f) => f.id === n.fieldId);
  return field ? { kind: 'cond', field, op: n.op, val: n.val, val2: n.val2 } : null; // stale fieldId — drop the leaf, keep the tree
}

export function serializeConfig<F extends { id: string }>(b: LiveConfig<F>): SerializedConfig {
  return {
    tableId: b.tableId,
    hiddenCols: Array.from(b.hiddenCols),
    filterTree: serializeNode(b.filterTree) as SerializedGroup,
    sortField: b.sortField,
    sortDir: b.sortDir,
    query: b.query,
    showRecId: b.showRecId,
    colOrder: b.colOrder.slice(),
    commentFilter: b.commentFilter,
  };
}

/**
 * Rehydrate a wire config against the CURRENT table. `syntheticColIds` are
 * non-field column ids that stay valid in hiddenCols/colOrder (the grid's
 * synthetic Record ID column).
 */
export function deserializeConfig<F extends { id: string }>(
  sc: SerializedConfig,
  t: { fields: F[] },
  syntheticColIds: readonly string[] = [],
): LiveConfig<F> {
  const validIds = new Set<string>([...syntheticColIds, ...t.fields.map((f) => f.id)]);
  return {
    tableId: sc.tableId,
    hiddenCols: new Set((sc.hiddenCols || []).filter((id) => validIds.has(id))),
    filterTree: sc.filterTree ? ((deserializeNode(sc.filterTree, t) as LiveGroup<F>) || emptyGroup<F>()) : emptyGroup<F>(),
    // Absent/malformed degrades to 'all' — the safe default (comments-explorer).
    commentFilter: sc.commentFilter === 'with' || sc.commentFilter === 'without' ? sc.commentFilter : 'all',
    sortField: sc.sortField && t.fields.some((f) => f.id === sc.sortField) ? sc.sortField : '',
    sortDir: sc.sortDir === -1 ? -1 : 1,
    query: sc.query || '',
    showRecId: !!sc.showRecId,
    colOrder: (sc.colOrder || []).filter((id) => validIds.has(id)),
  };
}

// ── Equality — dirty by DIFF, never a sticky boolean (Dan 2026-07-23) ──

export function treeEq<F extends { id: string }>(a: LiveGroup<F>, b: LiveGroup<F>): boolean {
  if (a.conjunction !== b.conjunction || a.children.length !== b.children.length) return false;
  return a.children.every((ca, i) => {
    const cb = b.children[i]!;
    if (ca.kind !== cb.kind) return false;
    if (ca.kind === 'group') return treeEq(ca, cb as LiveGroup<F>);
    const cbc = cb as LiveCond<F>;
    return ca.field.id === cbc.field.id && ca.op === cbc.op && ca.val === cbc.val && (ca.val2 || '') === (cbc.val2 || '');
  });
}

/** Hidden columns are a SET (order doesn't matter), not a sequence. */
export function setEq(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/** Structural equality of two baseline snapshots — every facet must match to read CLEAN. */
export function configEq<F extends { id: string }>(a: LiveConfig<F>, b: LiveConfig<F>): boolean {
  return (
    a.tableId === b.tableId &&
    a.sortField === b.sortField &&
    a.sortDir === b.sortDir &&
    a.query === b.query &&
    a.showRecId === b.showRecId &&
    a.colOrder.join('\0') === b.colOrder.join('\0') &&
    a.commentFilter === b.commentFilter &&
    setEq(a.hiddenCols, b.hiddenCols) &&
    treeEq(a.filterTree, b.filterTree)
  );
}
