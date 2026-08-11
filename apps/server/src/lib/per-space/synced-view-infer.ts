// Pure synced-view inference heuristic (workflows-relationship-inference).
//
// After a schema capture, the relationship-inference task proposes "synced view"
// candidates: pairs of tables whose field structure overlaps strongly enough to
// suggest one is a synced copy of the other (Airtable's Sync feature, which the
// API does not flag). This is a guess — the user confirms or dismisses it, and
// dismissed pairs are never re-proposed.
//
// Pure (no DB, no AI, no clock/random): takes slim table/field rows + the prior
// dismissals and returns the candidates. The task wrapper persists them via the
// engine sync route; the engine merges with the confirm/dismiss lifecycle.

export interface InferTableRow {
  tableId: string;
  baseId: string;
  name: string;
}

export interface InferFieldRow {
  tableId: string;
  name: string;
  type: string;
}

export interface MatchedFieldPair {
  sourceFieldName: string;
  destFieldName: string;
  type: string;
}

export interface SyncedViewCandidate {
  baseId: string;
  /** Canonical ordering: sourceTableId < destTableId (string compare). */
  sourceTableId: string;
  destTableId: string;
  /** 0..100 — matched field count over the smaller table's field count. */
  matchScore: number;
  matchedPairs: MatchedFieldPair[];
}

export interface InferSyncedViewsInput {
  tables: InferTableRow[];
  fields: InferFieldRow[];
  /** Pairs the user already dismissed (order-insensitive) — never re-proposed. */
  dismissed?: { sourceTableId: string; destTableId: string }[];
  /** Minimum matchScore to propose (default 60). */
  threshold?: number;
  /** Minimum matched field count to propose (default 2). */
  minMatches?: number;
}

function norm(name: string): string {
  return name.trim().toLowerCase();
}

function dismissedKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/**
 * Infer synced-view candidates by field name+type overlap between tables of the
 * same base. One candidate per unordered table pair (canonical source<dest), so
 * A↔B is proposed once. Deterministic: results are sorted by base, then pair.
 */
export function inferSyncedViews(
  input: InferSyncedViewsInput,
): SyncedViewCandidate[] {
  const threshold = input.threshold ?? 60;
  const minMatches = input.minMatches ?? 2;
  const dismissed = new Set(
    (input.dismissed ?? []).map((d) => dismissedKey(d.sourceTableId, d.destTableId)),
  );

  // Index fields by table; preserve a normalized (name|type) signature set.
  const fieldsByTable = new Map<string, InferFieldRow[]>();
  for (const f of input.fields) {
    const list = fieldsByTable.get(f.tableId);
    if (list) list.push(f);
    else fieldsByTable.set(f.tableId, [f]);
  }

  const candidates: SyncedViewCandidate[] = [];

  // Compare every unordered pair of tables within the same base.
  for (let i = 0; i < input.tables.length; i++) {
    for (let j = i + 1; j < input.tables.length; j++) {
      const a = input.tables[i]!;
      const b = input.tables[j]!;
      if (a.baseId !== b.baseId) continue;

      const [source, dest] =
        a.tableId < b.tableId ? [a, b] : [b, a];
      if (dismissed.has(dismissedKey(source.tableId, dest.tableId))) continue;

      const srcFields = fieldsByTable.get(source.tableId) ?? [];
      const dstFields = fieldsByTable.get(dest.tableId) ?? [];
      if (srcFields.length === 0 || dstFields.length === 0) continue;

      // Match by normalized name + identical type. Each dest field matches at
      // most once (first source field with the same signature wins).
      const destBySig = new Map<string, InferFieldRow>();
      for (const f of dstFields) {
        const sig = `${norm(f.name)}|${f.type}`;
        if (!destBySig.has(sig)) destBySig.set(sig, f);
      }
      const used = new Set<string>();
      const matchedPairs: MatchedFieldPair[] = [];
      for (const sf of srcFields) {
        const sig = `${norm(sf.name)}|${sf.type}`;
        const df = destBySig.get(sig);
        if (df && !used.has(sig)) {
          used.add(sig);
          matchedPairs.push({
            sourceFieldName: sf.name,
            destFieldName: df.name,
            type: sf.type,
          });
        }
      }

      if (matchedPairs.length < minMatches) continue;
      const smaller = Math.min(srcFields.length, dstFields.length);
      const matchScore = Math.round((100 * matchedPairs.length) / smaller);
      if (matchScore < threshold) continue;

      candidates.push({
        baseId: source.baseId,
        sourceTableId: source.tableId,
        destTableId: dest.tableId,
        matchScore,
        matchedPairs,
      });
    }
  }

  // Deterministic order: base, then source, then dest.
  candidates.sort((x, y) =>
    x.baseId !== y.baseId
      ? x.baseId < y.baseId
        ? -1
        : 1
      : x.sourceTableId !== y.sourceTableId
        ? x.sourceTableId < y.sourceTableId
          ? -1
          : 1
        : x.destTableId < y.destTableId
          ? -1
          : 1,
  );

  return candidates;
}
