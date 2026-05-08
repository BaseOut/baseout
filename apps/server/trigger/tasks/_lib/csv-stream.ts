// CSV transformer for the backup-base Trigger.dev task.
//
// Runs in Node (Trigger.dev runner), not workerd. Pure function: given one
// page of records and the explicit field list, returns the CSV string for
// that page. The task pages records out of Airtable and POSTs the CSV bytes
// to apps/server's /api/internal/runs/:runId/upload-csv route, which writes
// to R2 via the BACKUP_BUCKET binding.
//
// Output shape (CRLF line endings + RFC-4180-style quoting via Papa Parse):
//   header,row\r\n
//   value,value\r\n
//
// Restore code consumes the file by header — so this helper's contract with
// the rest of the system is that the column order in the CSV equals the
// `fields` array order, regardless of the row object's key order.

import Papa from "papaparse";

export interface PageToCsvInput {
  /** Column order. CSV header + each row is emitted in this order. */
  fields: string[];
  /** One page of rows. Empty array yields a header-only CSV. */
  rows: ReadonlyArray<Record<string, unknown>>;
}

/**
 * Transform one page of records into a CSV string.
 *
 * Empty `rows` produces a header-only CSV (a deliberate choice — restore
 * code can distinguish an empty Airtable table from a missing one by the
 * presence of the file with just the header line).
 *
 * Non-string cells (arrays, objects from linked-record / lookup / multi-
 * select / attachment fields, numbers, booleans) are JSON-serialized
 * before Papa Parse sees them. Without this, Papa.unparse joins arrays
 * with commas — lossy, can't be safely round-tripped on restore. JSON
 * keeps the original shape recoverable.
 */
export function pageToCsv(input: PageToCsvInput): string {
  const body = Papa.unparse(
    {
      fields: [...input.fields],
      data: input.rows.map((row) =>
        input.fields.map((f) => stringifyCell(row[f])),
      ),
    },
    { newline: "\r\n", header: true },
  );
  // Papa.unparse trails the header with \r\n when data is empty, but does
  // NOT trail the final data row when data is non-empty. Normalize so every
  // CSV file ends with exactly one \r\n.
  return body.endsWith("\r\n") ? body : body + "\r\n";
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  // Arrays, plain objects, anything else → JSON. Round-trip safe for restore.
  return JSON.stringify(value);
}
