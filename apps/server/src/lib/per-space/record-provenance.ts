// Pure cell-provenance interpretation + linked-set paging for the /data browser
// (server-data-browse Task 1.3). No I/O. Interprets `bo_at_fields.options` (all
// metadata is already captured — this is reading it, not re-deriving), and
// builds the parameterized fragments the -io side uses to hydrate linked sets.
// Formula refs come from `options.referencedFieldIds` ONLY — never by parsing
// the expression text (fall back to null-with-reason when absent).

import { sql, type SQL } from 'drizzle-orm'

export type Provenance =
  | { kind: 'formula'; expression: string | null; referencedFieldIds: string[] | null; reason?: string }
  | { kind: 'lookup'; recordLinkFieldId: string | null; fieldIdInLinkedTable: string | null; reason?: string }
  | { kind: 'rollup'; recordLinkFieldId: string | null; fieldIdInLinkedTable: string | null; aggregation: string | null; reason?: string }
  | { kind: 'linked'; linkedTableId: string | null }
  | { kind: 'none' }

const LOOKUP_TYPES = new Set(['multipleLookupValues', 'lookup'])
const ROLLUP_TYPES = new Set(['rollup', 'count'])
const LINKED_TYPES = new Set(['multipleRecordLinks'])

function asRecord(o: unknown): Record<string, unknown> {
  return o && typeof o === 'object' ? (o as Record<string, unknown>) : {}
}
function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}
function strArray(v: unknown): string[] | null {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null
}

/** Map a field's type + options to its provenance shape (one level, no recursion). */
export function interpretProvenance(field: { type: string; options: unknown }): Provenance {
  const o = asRecord(field.options)

  if (field.type === 'formula') {
    const refs = strArray(o.referencedFieldIds)
    return refs
      ? { kind: 'formula', expression: str(o.formula), referencedFieldIds: refs }
      : { kind: 'formula', expression: str(o.formula), referencedFieldIds: null, reason: 'referencedFieldIds not captured in field options' }
  }

  if (ROLLUP_TYPES.has(field.type)) {
    return {
      kind: 'rollup',
      recordLinkFieldId: str(o.recordLinkFieldId),
      fieldIdInLinkedTable: str(o.fieldIdInLinkedTable),
      aggregation: str(o.aggregation) ?? str(o.function) ?? null,
    }
  }

  if (LOOKUP_TYPES.has(field.type)) {
    return {
      kind: 'lookup',
      recordLinkFieldId: str(o.recordLinkFieldId),
      fieldIdInLinkedTable: str(o.fieldIdInLinkedTable),
    }
  }

  if (LINKED_TYPES.has(field.type)) {
    return { kind: 'linked', linkedTableId: str(o.linkedTableId) }
  }

  return { kind: 'none' }
}

// ── Linked-set expansion (the link cell holds a JSON id array) ────────────────

/** Parse a link cell's JSON-encoded id list; tolerant of null/non-array/garbage. */
export function parseLinkIds(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Keyset-page the id list itself, so a 10k-id cell never hydrates in one call.
 * Cursor = the last id returned; a next page starts after its position (falling
 * back to the start if the cursor id is no longer present).
 */
export function pageLinkIds(
  ids: string[],
  afterId: string | null,
  limit: number,
): { pageIds: string[]; nextCursor: string | null } {
  let start = 0
  if (afterId) {
    const idx = ids.indexOf(afterId)
    start = idx >= 0 ? idx + 1 : 0
  }
  const pageIds = ids.slice(start, start + limit)
  const hasMore = start + limit < ids.length
  return { pageIds, nextCursor: hasMore ? (pageIds[pageIds.length - 1] ?? null) : null }
}

/** Bounding predicate: outer record is one of the page's linked ids. */
export function linkedSetPredicate(pageIds: string[]): SQL {
  return sql`bo_at_records.record_id = any(${pageIds})`
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`)
}

/** Search-within-the-set: ILIKE on the linked table's primary field value. */
export function primaryFieldSearchPredicate(tableId: string, primaryFieldId: string, q: string): SQL {
  return sql`exists (select 1 from bo_at_record_field_data rfd where rfd.table_id = ${tableId} and rfd.field_id = ${primaryFieldId} and rfd.record_id = bo_at_records.record_id and rfd.value ilike ${'%' + escapeLike(q) + '%'})`
}

/** Dangling ids (linked record deleted since the backup) → explicit missing rows. */
export function markMissing(requestedIds: string[], foundIds: Set<string>): Array<{ recordId: string; missing: true }> {
  return requestedIds.filter((id) => !foundIds.has(id)).map((recordId) => ({ recordId, missing: true }))
}
