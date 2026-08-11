// Pure export writers for the /data browser (server-data-browse Task 1.4). No
// I/O — CSV escaping, per-cell export formatting (JSON-decoding stored values;
// attachment cells become backup-file *references*, never re-downloaded bytes),
// and a streaming CSV line generator the route pipes straight to the response.
// JSON export nests `{ base → table → rows }` for multi-entity scopes.

/** RFC-4180 CSV field escaping: quote when the field holds a comma, quote, or newline. */
export function csvEscape(field: string): string {
  return /[",\n\r]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field
}

/** One CSV record; null cells render empty. */
export function csvLine(fields: Array<string | null>): string {
  return fields.map((f) => csvEscape(f ?? '')).join(',')
}

const ATTACHMENT_TYPES = new Set(['multipleAttachments'])

/**
 * Flatten a stored (JSON-encoded) cell value to a single export string.
 * Attachment cells become semicolon-joined backup references (filename → url →
 * id), never bytes. Arrays join with ", "; objects serialize; scalars stringify.
 */
export function formatCellForExport(value: string | null, fieldType: string): string {
  if (value == null) return ''
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return value // legacy/non-JSON value — pass through
  }
  if (parsed == null) return ''

  if (ATTACHMENT_TYPES.has(fieldType) && Array.isArray(parsed)) {
    return parsed
      .map((a) => {
        if (a && typeof a === 'object') {
          const o = a as Record<string, unknown>
          return String(o.filename ?? o.url ?? o.id ?? '')
        }
        return String(a)
      })
      .filter(Boolean)
      .join('; ')
  }
  if (Array.isArray(parsed)) {
    return parsed.map((x) => (x && typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ')
  }
  if (typeof parsed === 'object') return JSON.stringify(parsed)
  return String(parsed)
}

/** Streaming CSV: header first, then one line per row. The route pipes each
 *  chunk out without buffering the set (PRD §7.2). */
export function* csvLines(header: string[], rows: Iterable<Array<string | null>>): Generator<string> {
  yield csvLine(header)
  for (const row of rows) yield csvLine(row)
}

export interface JsonTableExport {
  tableId: string
  tableName: string | null
  rows: Array<Record<string, string | null>>
}
export interface JsonBaseExport {
  baseId: string
  baseName: string | null
  tables: JsonTableExport[]
}

/** Nested JSON export shape for a multi-entity scope: base → table → rows. */
export function jsonExportShape(bases: JsonBaseExport[]): { bases: JsonBaseExport[] } {
  return { bases }
}
