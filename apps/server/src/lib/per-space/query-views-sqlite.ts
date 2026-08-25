// Per-table query-view generation — D1/SQLite dialect, PURE (no I/O).
//
// MIRROR of ./query-views.ts (managed_pg matviews) for the d1 backend
// (server-d1-backend 4.2, system-per-space-db §4.2 design Decision 7): records
// live generically in bo_at_records + bo_at_record_field_data (EAV,
// JSON-encoded `value`); ergonomic per-table views are generated on top.
// SQLite has no materialized views and per-Space D1 sizes are entry-tier by
// definition, so the d1 realization is a LIVE pivot: plain CREATE VIEWs whose
// SELECT re-aggregates at query time (design D4 — if this is ever too slow,
// the answer is promotion to managed_pg, not a caching layer).
//
// Name planning intentionally mirrors the pg planner (same sanitize, dedupe,
// and 63-char truncation) so a Space keeps identical view names across a
// d1 → managed_pg upgrade; the only addition is the sqlite_ reserved-prefix
// guard (SQLite refuses objects named sqlite_*).
//
// Safe-casting is load-bearing (design risk): a retyped field can hold
// non-conforming old values, and one bad value must NULL out — never error
// the view. SQLite's json() ERRORS on invalid input, so cell decoding is
// guarded by json_valid; typed columns are guarded by json_type. There are
// no helper functions to install (no plpgsql equivalent needed).
//
// Application rides the D1 write path (schema-sync's d1 arm) when that lands —
// at provision time a fresh database has no tables to pivot.

import type { QueryViewField, QueryViewTable } from "./query-views";

const IDENTIFIER_MAX = 63; // kept in lockstep with pg for cross-backend name parity

/** Projection columns every generated view carries; field columns dedupe against them. */
const RESERVED_COLUMNS = ["record_id", "created_time", "modified_time"];

const lit = (s: string): string => s.replace(/'/g, "''");
/** JSON-path label: strip double quotes (path delimiter), escape single quotes (SQL). */
const pathLabel = (s: string): string => lit(s.replace(/"/g, ""));

function sanitize(name: string, fallback: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const base = /[a-z0-9]/.test(cleaned) ? cleaned : fallback;
  const guarded =
    base.startsWith("bo_at_") || base.startsWith("pg_") || base.startsWith("sqlite_")
      ? `v_${base}`
      : base;
  return guarded.slice(0, IDENTIFIER_MAX);
}

/** Claim `base` in `taken`, suffixing _2, _3, … on collision (truncation-safe). */
function dedupe(base: string, taken: Set<string>): string {
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) {
    const suffix = `_${n}`;
    candidate = base.slice(0, IDENTIFIER_MAX - suffix.length) + suffix;
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
/** Date-ish values stay ISO text (SQLite has no date type; ISO orders correctly). */
const TEXT_DATE_TYPES = new Set(["date", "dateTime", "createdTime", "lastModifiedTime"]);

function columnExpr(fieldType: string, path: string): string {
  if (NUMERIC_TYPES.has(fieldType)) {
    return `CASE WHEN json_type(c.vals, ${path}) IN ('integer', 'real') THEN json_extract(c.vals, ${path}) END`;
  }
  if (fieldType === "checkbox") {
    return `CASE WHEN json_type(c.vals, ${path}) IN ('true', 'false') THEN json_extract(c.vals, ${path}) END`;
  }
  if (TEXT_DATE_TYPES.has(fieldType)) {
    return `CASE WHEN json_type(c.vals, ${path}) = 'text' THEN json_extract(c.vals, ${path}) END`;
  }
  // Default + structured types: plain extraction. Scalars come out native;
  // arrays/objects come out as their JSON text (the pg jsonb equivalent).
  return `json_extract(c.vals, ${path})`;
}

/**
 * DROP + CREATE VIEW for one table. Cells aggregate into one JSON map per
 * record (single join regardless of field count) and each field column
 * safe-casts out of it at query time — the live pivot.
 */
export function buildQueryViewStatements(
  viewName: string,
  tableId: string,
  fields: QueryViewField[],
): string[] {
  const takenColumns = new Set(RESERVED_COLUMNS);
  const columns = fields.map((f) => {
    const name = dedupe(sanitize(f.name, `field_${f.fieldId.toLowerCase()}`), takenColumns);
    const path = `'$."${pathLabel(f.fieldId)}"'`;
    return `  ${columnExpr(f.type, path)} AS "${name}"`;
  });

  const select = [
    "  r.record_id",
    "  r.created_time",
    "  r.modified_time",
    ...columns,
  ].join(",\n");

  const create =
    `CREATE VIEW "${viewName}" AS\n` +
    `SELECT\n${select}\n` +
    `FROM bo_at_records r\n` +
    `LEFT JOIN (\n` +
    `  SELECT record_id, json_group_object(field_id, CASE WHEN json_valid(value) THEN json(value) END) AS vals\n` +
    `  FROM bo_at_record_field_data\n` +
    `  WHERE table_id = '${lit(tableId)}' AND value IS NOT NULL\n` +
    `  GROUP BY record_id\n` +
    `) c ON c.record_id = r.record_id\n` +
    `WHERE r.table_id = '${lit(tableId)}' AND r.status = 'active'`;

  return [`DROP VIEW IF EXISTS "${viewName}"`, create];
}

/**
 * Drop views that no longer correspond to an active table. `existing` comes
 * from sqlite_master (type='view') scoped to this Space's database, so every
 * listed name is one of ours.
 */
export function dropStaleViewStatements(
  existing: string[],
  expected: ReadonlySet<string>,
): string[] {
  return existing
    .filter((name) => !expected.has(name))
    .map((name) => `DROP VIEW IF EXISTS "${name.replace(/"/g, '""')}"`);
}
