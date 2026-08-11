// Human-safe CSV guard for the portable export archive
// (shared-data-portability task 2.1, design D5).
//
// Fresh re-implementation of the escapeCsvCell / FORMULA_TRIGGERS semantics
// first shipped for schema export (apps/web/src/lib/csv.ts). apps/web is not
// importable from apps/workflows, and per the change this is re-implemented
// once here rather than extracted to @baseout/shared.
//
// WHY this exists and the backup pipeline's pageToCsv (_lib/csv-stream.ts) does
// NOT guard: an Airtable formula field literally begins with `=`. Restore reads
// snapshot CSVs back into a machine, so pageToCsv keeps values verbatim (a
// round-trip). The portable archive is opened by a HUMAN in Excel/Sheets, where
// a leading `=` becomes an executable formula — OWASP CSV Injection. So the
// bundler re-emits every cell through this guard.

import Papa from "papaparse";

/** Characters that make a spreadsheet treat a cell as a formula, not text. */
export const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r", "\n"] as const;

/**
 * One cell. Quoted always (so commas, semicolons, and newlines inside Airtable
 * long-text survive), inner quotes doubled per RFC-4180, and a leading formula
 * trigger neutralized with a single quote. The guard runs BEFORE quote-doubling
 * so a `="a"` payload is both defanged and correctly escaped.
 */
export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const guarded = FORMULA_TRIGGERS.some((c) => raw.startsWith(c))
    ? `'${raw}`
    : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/**
 * A whole table. `rows` are already in column order; `header` is the first
 * line. CRLF endings + a trailing CRLF, matching pageToCsv and what Excel is
 * happiest with (RFC-4180).
 */
export function formatGuardedCsv(
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}

export interface ReguardedCsv {
  /** The re-emitted, formula-guarded CSV text. */
  content: string;
  /** Data-row count (excludes the header line). Feeds the manifest count. */
  recordCount: number;
}

/**
 * Re-emit an unguarded snapshot CSV (as written by pageToCsv) through the
 * guard, preserving column order, and report the data-row count.
 *
 * Parsed header-less so exact column order is retained (Papa's object mode
 * keys by header and loses order guarantees); `skipEmptyLines` drops the
 * trailing blank line pageToCsv leaves. A header-only CSV yields 0 records.
 *
 * NOTE: this reads a whole table CSV into memory to re-serialize it. The
 * streaming, never-buffer-a-whole-base assembler is task 2.4 (deferred — no
 * zip library in the workspace yet); this pure helper is what that assembler
 * will call per table.
 */
export function reguardCsv(csv: string | Buffer): ReguardedCsv {
  const input = Buffer.isBuffer(csv) ? csv.toString("utf8") : csv;
  const parsed = Papa.parse<string[]>(input, {
    header: false,
    skipEmptyLines: true,
  });
  const grid = parsed.data;
  const header = grid[0];
  if (header === undefined) {
    return { content: "", recordCount: 0 };
  }
  const rows = grid.slice(1);
  return {
    content: formatGuardedCsv(header, rows),
    recordCount: rows.length,
  };
}
