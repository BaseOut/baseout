// Per-table query-view generation — PURE (no I/O), unit-tested.
//
// system-per-space-db §4.2 (design Decision 7): records live generically in
// bo_at_records + bo_at_record_field_data (EAV, JSON-encoded `value`);
// ergonomic per-table views are generated on top so SQL-API filters hit native
// typed columns. managed_pg realizes them as MATERIALIZED VIEWs rebuilt per
// run (drop + create repopulates — no separate REFRESH step). The D1 live
// pivot-view variant ships with the d1 backend (currently
// backend_not_implemented).
//
// Names are the clean raw Airtable table names (design Decision 6: `deals`,
// not bo_at_*), sanitized to Postgres identifiers and deduped across the WHOLE
// Space schema (two bases can each have a "Deals" table; matviews share one
// namespace). A `v_` guard keeps a generated view from ever shadowing a
// bo_at_* table or a pg_* name.
//
// Safe-casting is load-bearing (design risk): a retyped field can hold
// non-conforming old values, and one bad value must NULL out — never error the
// whole view. Numeric/boolean casts are guarded by jsonb_typeof; date casts go
// through plpgsql try-functions; cell decoding itself goes through
// bo_at_try_jsonb. The applier lives in query-views-io.ts.

export interface QueryViewTable {
  tableId: string;
  name: string;
}

export interface QueryViewField {
  fieldId: string;
  name: string;
  type: string;
}

const PG_IDENTIFIER_MAX = 63;

/** Projection columns every generated view carries; field columns dedupe against them. */
const RESERVED_COLUMNS = ["record_id", "created_time", "modified_time"];

const lit = (s: string): string => s.replace(/'/g, "''");

function sanitize(name: string, fallback: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const base = /[a-z0-9]/.test(cleaned) ? cleaned : fallback;
  const guarded = base.startsWith("bo_at_") || base.startsWith("pg_") ? `v_${base}` : base;
  return guarded.slice(0, PG_IDENTIFIER_MAX);
}

/** Claim `base` in `taken`, suffixing _2, _3, … on collision (truncation-safe). */
function dedupe(base: string, taken: Set<string>): string {
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) {
    const suffix = `_${n}`;
    candidate = base.slice(0, PG_IDENTIFIER_MAX - suffix.length) + suffix;
  }
  taken.add(candidate);
  return candidate;
}

/**
 * Assign a view name to every active table. Sorted by tableId first so
 * collision suffixes are deterministic regardless of read order.
 */
export function planViewNames(tables: QueryViewTable[]): Map<string, string> {
  const taken = new Set<string>();
  const out = new Map<string, string>();
  for (const t of [...tables].sort((a, b) => a.tableId.localeCompare(b.tableId))) {
    const base = sanitize(t.name, `table_${t.tableId.toLowerCase()}`);
    out.set(t.tableId, dedupe(base, taken));
  }
  return out;
}

// ── Column expressions (Airtable field type → safe-cast SQL) ─────────────────

const NUMERIC_TYPES = new Set([
  "number", "currency", "percent", "duration", "rating", "count", "autoNumber",
]);
const TIMESTAMPTZ_TYPES = new Set(["dateTime", "createdTime", "lastModifiedTime"]);
/** Structured values stay jsonb (arrays/objects — links, attachments, collaborators, …). */
const JSONB_TYPES = new Set([
  "multipleAttachments", "multipleRecordLinks", "multipleSelects",
  "multipleCollaborators", "multipleLookupValues", "singleCollaborator",
  "createdBy", "lastModifiedBy", "barcode", "button", "aiText",
]);

function columnExpr(fieldType: string, ref: string): string {
  if (NUMERIC_TYPES.has(fieldType)) {
    return `CASE WHEN jsonb_typeof(${ref}) = 'number' THEN (${ref})::numeric END`;
  }
  if (fieldType === "checkbox") {
    return `CASE WHEN jsonb_typeof(${ref}) = 'boolean' THEN (${ref})::boolean END`;
  }
  if (TIMESTAMPTZ_TYPES.has(fieldType)) return `bo_at_try_timestamptz(${ref} #>> '{}')`;
  if (fieldType === "date") return `bo_at_try_date(${ref} #>> '{}')`;
  if (JSONB_TYPES.has(fieldType)) return ref;
  // Default: text extraction. Scalars come out clean; an unexpected
  // array/object renders as its JSON text rather than erroring.
  return `${ref} #>> '{}'`;
}

/**
 * Idempotent per-schema safe-cast helpers (CREATE OR REPLACE — re-run on every
 * regeneration; unqualified names land in the Space schema via search_path).
 * plpgsql exception handling is the only bulletproof "NULL on failure" cast:
 * regex guards can't reject e.g. '2026-13-45'.
 */
export function queryViewHelperStatements(): string[] {
  const tryFn = (name: string, returns: string) =>
    `CREATE OR REPLACE FUNCTION ${name}(v text) RETURNS ${returns} LANGUAGE plpgsql IMMUTABLE AS ` +
    `$fn$ BEGIN RETURN v::${returns}; EXCEPTION WHEN others THEN RETURN NULL; END $fn$`;
  return [
    tryFn("bo_at_try_jsonb", "jsonb"),
    tryFn("bo_at_try_timestamptz", "timestamptz"),
    tryFn("bo_at_try_date", "date"),
  ];
}

/**
 * DROP + CREATE MATERIALIZED VIEW for one table. Cells aggregate into one
 * jsonb map per record (single join regardless of field count — Airtable
 * tables can carry 100+ fields) and each field column safe-casts out of it.
 */
export function buildQueryViewStatements(
  viewName: string,
  tableId: string,
  fields: QueryViewField[],
): string[] {
  const takenColumns = new Set(RESERVED_COLUMNS);
  const columns = fields.map((f) => {
    const name = dedupe(sanitize(f.name, `field_${f.fieldId.toLowerCase()}`), takenColumns);
    const expr = columnExpr(f.type, `c.vals -> '${lit(f.fieldId)}'`);
    return `  ${expr} AS "${name}"`;
  });

  const select = [
    "  r.record_id",
    "  r.created_time",
    "  r.modified_time",
    ...columns,
  ].join(",\n");

  const create =
    `CREATE MATERIALIZED VIEW "${viewName}" AS\n` +
    `SELECT\n${select}\n` +
    `FROM bo_at_records r\n` +
    `LEFT JOIN (\n` +
    `  SELECT record_id, jsonb_object_agg(field_id, bo_at_try_jsonb(value)) AS vals\n` +
    `  FROM bo_at_record_field_data\n` +
    `  WHERE table_id = '${lit(tableId)}' AND value IS NOT NULL\n` +
    `  GROUP BY record_id\n` +
    `) c ON c.record_id = r.record_id\n` +
    `WHERE r.table_id = '${lit(tableId)}' AND r.status = 'active'`;

  return [`DROP MATERIALIZED VIEW IF EXISTS "${viewName}"`, create];
}

/**
 * Drop matviews that no longer correspond to an active table (removed or
 * renamed tables lose their views). `existing` comes from pg_matviews scoped
 * to the Space schema, so every listed name is one of ours.
 */
export function dropStaleViewStatements(
  existing: string[],
  expected: ReadonlySet<string>,
): string[] {
  return existing
    .filter((name) => !expected.has(name))
    .map((name) => `DROP MATERIALIZED VIEW IF EXISTS "${name.replace(/"/g, '""')}"`);
}
