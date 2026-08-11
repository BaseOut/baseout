// Per-Space record capture diff — PURE (no I/O), unit-tested.
//
// Given the records captured from Airtable for ONE table + the current per-Space
// state (bo_at_records + bo_at_record_field_data), compute:
//   - record lifecycle ops (insert / seen / deleted / unknown),
//   - cell ops for bo_at_record_field_data (insert / update / seen),
//   - superseded-value log ops for bo_at_record_updates (the OLD value being replaced).
//
// Rules (openspec/changes/system-per-space-db, specs "Generic record storage" +
// "Record change history"):
//   - Cells are sparse-until-first-value: first population creates a row and logs
//     NOTHING. A later change updates the row and appends the OLD value to the log.
//   - A cleared cell (was populated, now absent) sets value=null and logs the old
//     value; the row persists (its history stays anchored).
//   - Values are JSON-encoded text (matching bo_at_record_field_data.value).
//   - Absent records on a CONFIDENT (fully-paged) capture → deleted; on a partial/
//     trial-truncated capture → unknown (never false-delete). Cell completeness is
//     per-record (Airtable returns a record's full populated cell set in one page),
//     so cleared-cell detection is valid regardless of table-level confidence.

export type RecordAction = "insert" | "seen" | "deleted" | "unknown";
export type CellAction = "insert" | "update" | "seen";

export interface CapturedRecord {
  recordId: string;
  createdTime?: string | null;
  modifiedTime?: string | null;
  /** fieldId → raw normalized value. Only populated fields are present (Airtable omits empties). */
  cells: Record<string, unknown>;
}

export interface PriorRecord {
  recordId: string;
  status: string;
}
export interface PriorCell {
  recordId: string;
  fieldId: string;
  /** Stored JSON-encoded value, or null if previously cleared. */
  value: string | null;
}

export interface RecordLifecycleOp {
  recordId: string;
  action: RecordAction;
  createdTime: string | null;
  modifiedTime: string | null;
}
export interface CellOp {
  recordId: string;
  fieldId: string;
  action: CellAction;
  /** JSON-encoded value, or null for a cleared cell. */
  value: string | null;
}
export interface RecordUpdateOp {
  recordId: string;
  fieldId: string;
  /** The superseded (old) JSON-encoded value being replaced. */
  oldValue: string | null;
}

export interface RecordDiffResult {
  tableId: string;
  records: RecordLifecycleOp[];
  cells: CellOp[];
  recordUpdates: RecordUpdateOp[];
}

/** JSON-encode a captured cell value for storage; empty ⇒ null. */
export function encodeCellValue(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return JSON.stringify(v);
}

export function diffRecords(args: {
  tableId: string;
  captured: CapturedRecord[];
  priorRecords: PriorRecord[];
  priorCells: PriorCell[];
  runId: string;
  /** Were ALL of the table's records enumerated this run? false ⇒ absent records are unknown, not deleted. */
  confident: boolean;
}): RecordDiffResult {
  const { tableId, captured, priorRecords, priorCells, confident } = args;
  const records: RecordLifecycleOp[] = [];
  const cells: CellOp[] = [];
  const recordUpdates: RecordUpdateOp[] = [];

  const priorRecordById = new Map(priorRecords.map((r) => [r.recordId, r]));
  const capturedById = new Map(captured.map((r) => [r.recordId, r]));

  // priorCells indexed by recordId → (fieldId → value).
  const priorCellsByRecord = new Map<string, Map<string, string | null>>();
  for (const c of priorCells) {
    let m = priorCellsByRecord.get(c.recordId);
    if (!m) priorCellsByRecord.set(c.recordId, (m = new Map()));
    m.set(c.fieldId, c.value);
  }

  for (const rec of captured) {
    const prior = priorRecordById.get(rec.recordId);
    records.push({
      recordId: rec.recordId,
      action: prior ? "seen" : "insert",
      createdTime: rec.createdTime ?? null,
      modifiedTime: rec.modifiedTime ?? null,
    });

    const priorCellMap = priorCellsByRecord.get(rec.recordId) ?? new Map<string, string | null>();
    const seenFields = new Set<string>();

    // Captured cells.
    for (const [fieldId, raw] of Object.entries(rec.cells)) {
      seenFields.add(fieldId);
      const enc = encodeCellValue(raw);
      if (!priorCellMap.has(fieldId)) {
        // Never populated before: first population creates the row, logs nothing.
        if (enc !== null) cells.push({ recordId: rec.recordId, fieldId, action: "insert", value: enc });
      } else {
        const old = priorCellMap.get(fieldId) ?? null;
        if (old !== enc) {
          cells.push({ recordId: rec.recordId, fieldId, action: "update", value: enc });
          recordUpdates.push({ recordId: rec.recordId, fieldId, oldValue: old });
        } else {
          cells.push({ recordId: rec.recordId, fieldId, action: "seen", value: enc });
        }
      }
    }

    // Cleared cells: previously populated, now absent from the capture.
    for (const [fieldId, old] of priorCellMap) {
      if (seenFields.has(fieldId)) continue;
      if (old !== null) {
        cells.push({ recordId: rec.recordId, fieldId, action: "update", value: null });
        recordUpdates.push({ recordId: rec.recordId, fieldId, oldValue: old });
      }
    }
  }

  // Records present before but absent now.
  for (const p of priorRecords) {
    if (capturedById.has(p.recordId)) continue;
    if (p.status === "deleted") continue;
    records.push({
      recordId: p.recordId,
      action: confident ? "deleted" : "unknown",
      createdTime: null,
      modifiedTime: null,
    });
  }

  return { tableId, records, cells, recordUpdates };
}
