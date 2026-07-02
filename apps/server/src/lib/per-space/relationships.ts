// Pure relationship derivation for the Relationships tab (server-relationships).
//
// API-derived relationships (linked records, formulas, rollups, lookups,
// lastModified) are NOT a separate persisted table — they are computed on read
// from the per-Space `bo_at_fields` rows the schema capture already writes.
// Only synced-view candidates (the inferred/confirm/dismiss lifecycle) need
// persistence (bo_at_synced_view_candidates).
//
// This module is pure (no DB, no AI): it takes slim field/table rows and returns
// the derived relationships with computed validity + removed-history flags. The
// engine route wraps it with the per-Space read; the web tab groups + filters.

// Conceptually 'active' | 'removed' | 'unknown', but the DB column is a plain
// text default — accept any string so per-Space rows assign without casts.
export type EntityStatus = string | null | undefined;

export interface RelTableRow {
  tableId: string;
  baseId: string;
  name: string;
  status?: EntityStatus;
}

export interface RelFieldRow {
  fieldId: string;
  tableId: string;
  baseId: string;
  name: string;
  type: string;
  /** Airtable type-specific config (linkedTableId, recordLinkFieldId, …). */
  options?: unknown;
  status?: EntityStatus;
}

export type RelationshipType =
  | "linkedRecords"
  | "formulas"
  | "rollups"
  | "lookups"
  | "lastModified";

export interface RelationshipRef {
  /** Referenced table (linkedRecords/rollups/lookups) when known. */
  tableId?: string;
  /** Referenced field (rollups/lookups source field) when known. */
  fieldId?: string;
  /** Human label for the reference (table or field name, or a raw id fallback). */
  name: string;
  /** True when the referenced entity is removed from Airtable. */
  removed: boolean;
}

export interface DerivedRelationship {
  /** Stable id: `${type}:${anchorFieldId}` — unique per anchor field. */
  id: string;
  baseId: string;
  type: RelationshipType;
  /** The field that defines the relationship (the link/formula/rollup/… field). */
  anchorFieldId: string;
  anchorTableId: string;
  /** "A ↔ B" compact summary for the row. */
  label: string;
  refs: RelationshipRef[];
  /** API-derived relationships are never inferred (synced views are). */
  inferred: false;
  /** Anchor or any referenced entity is removed from Airtable. */
  hasRemovedHistory: boolean;
  /** Valid when the anchor field is active and at least one ref resolves active. */
  valid: boolean;
}

const TYPE_MAP: Record<string, RelationshipType> = {
  multipleRecordLinks: "linkedRecords",
  formula: "formulas",
  rollup: "rollups",
  multipleLookupValues: "lookups",
  lastModifiedTime: "lastModified",
  lastModifiedBy: "lastModified",
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function isRemoved(s: EntityStatus): boolean {
  return s === "removed";
}

/**
 * Derive the API-level relationships for a base from its field rows.
 * `tables`/`fields` are the per-Space rows (any base mix is fine; results carry
 * baseId). Order is stable: grouped by anchor table appearance, then field.
 */
export function deriveRelationships(input: {
  tables: RelTableRow[];
  fields: RelFieldRow[];
}): DerivedRelationship[] {
  const tableById = new Map(input.tables.map((t) => [t.tableId, t]));
  const fieldById = new Map(input.fields.map((f) => [f.fieldId, f]));
  const out: DerivedRelationship[] = [];

  for (const field of input.fields) {
    const type = TYPE_MAP[field.type];
    if (!type) continue;

    const anchorTable = tableById.get(field.tableId);
    const anchorName = anchorTable?.name ?? field.tableId;
    const opts = asRecord(field.options);
    const refs: RelationshipRef[] = [];

    if (type === "linkedRecords") {
      const linkedTableId =
        typeof opts.linkedTableId === "string" ? opts.linkedTableId : undefined;
      if (linkedTableId) {
        const t = tableById.get(linkedTableId);
        refs.push({
          tableId: linkedTableId,
          name: t?.name ?? linkedTableId,
          removed: isRemoved(t?.status) || !t,
        });
      }
    } else if (type === "rollups" || type === "lookups") {
      // Both anchor through a linked-record field and pull a field in the
      // linked table: options.recordLinkFieldId + options.fieldIdInLinkedTable.
      const linkFieldId =
        typeof opts.recordLinkFieldId === "string"
          ? opts.recordLinkFieldId
          : undefined;
      const srcFieldId =
        typeof opts.fieldIdInLinkedTable === "string"
          ? opts.fieldIdInLinkedTable
          : undefined;
      for (const fid of [linkFieldId, srcFieldId]) {
        if (!fid) continue;
        const f = fieldById.get(fid);
        refs.push({
          fieldId: fid,
          tableId: f?.tableId,
          name: f?.name ?? fid,
          removed: isRemoved(f?.status) || !f,
        });
      }
    } else {
      // formulas + lastModified reference a set of fields (when Airtable exposes
      // them via options.referencedFieldIds).
      const ids = Array.isArray(opts.referencedFieldIds)
        ? (opts.referencedFieldIds as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [];
      for (const fid of ids) {
        const f = fieldById.get(fid);
        refs.push({
          fieldId: fid,
          tableId: f?.tableId,
          name: f?.name ?? fid,
          removed: isRemoved(f?.status) || !f,
        });
      }
    }

    const anchorRemoved = isRemoved(field.status);
    const refsRemoved = refs.length > 0 && refs.every((r) => r.removed);
    // Valid: the anchor is live and, when it references entities, at least one
    // still resolves. A relationship with no resolvable refs (e.g. a formula we
    // couldn't expand) is still valid as long as the anchor field is active.
    const valid =
      !anchorRemoved && (refs.length === 0 || refs.some((r) => !r.removed));

    const refLabel =
      refs.length === 0
        ? field.name
        : refs.map((r) => r.name).join(", ");

    out.push({
      id: `${type}:${field.fieldId}`,
      baseId: field.baseId,
      type,
      anchorFieldId: field.fieldId,
      anchorTableId: field.tableId,
      label: `${anchorName} ↔ ${refLabel}`,
      refs,
      inferred: false,
      hasRemovedHistory: anchorRemoved || refsRemoved || refs.some((r) => r.removed),
      valid,
    });
  }

  return out;
}

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  "linkedRecords",
  "formulas",
  "rollups",
  "lookups",
  "lastModified",
];
