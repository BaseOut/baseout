// Incremental-apply seam — PURE (no I/O), unit-tested.
//
// Server half of the engine-brokered IncrementalDb contract
// (openspec/changes/server-dynamic-mode, re-scoped 2026-07-23; Option B of
// system-per-space-db §3). CANONICAL WIRE-SHAPE SOURCE:
// apps/workflows/trigger/tasks/incremental-backup.ts — the SchemaWrite /
// RecordWrite unions below mirror the shapes its pure orchestration emits and
// its task wrapper will POST here once its notYetWired stubs are connected.
// Keep the two in lockstep; a shape change is a cross-app contract change
// (CLAUDE.md §7) and must land on both sides.
//
// This module decides WHAT rows change; incremental-io.ts applies the plan
// inside a withSpaceSchema transaction. Semantics (mirroring the workflows-side
// doc block + the per-space model):
//   - destroys are CONFIDENT removals: status='removed' (+cascade) for
//     tables/fields, status='deleted' for records — never 'unknown'.
//   - record cells are sparse-until-first-value; empty values on a create are
//     dropped, first population logs nothing, superseded values are logged from
//     the caller-provided stored value (already OUR value, per the workflows
//     diff), attribution (action_source/actor) rides every payload-derived log.
//   - updateField/updateTableMetadata patch ONLY the keys present — a
//     description-only change never touches ai_description/description_override.
//   - updateView is SKIPPED (counted) until the Enterprise view-capture gate
//     exists (system-per-space-db 8.2); the workflows side doesn't emit it by
//     default (viewCaptureEnabled defaults false).
//   - name/type NOT NULL fallbacks: a null created-entity name coalesces to ''
//     and a null field type to 'unknown' (bo_at_tables.name / bo_at_fields.type
//     are NOT NULL; payloads normally always carry them).

import { encodeCellValue } from "./record-diff";

// ── Wire shapes (mirror of apps/workflows/trigger/tasks/incremental-backup.ts) ──

export interface WireAttribution {
  actionSource: string | null;
  actor: string | null;
}

export interface WireSchemaUpdateLog extends WireAttribution {
  changeType: "name" | "description" | "type" | "config";
  beforeValue: unknown;
  afterValue: unknown;
  breaksData: boolean;
}

export type SchemaWrite =
  | {
      kind: "createTable";
      tableId: string;
      name: string | null;
      description: string | null;
      fields: { fieldId: string; name: string | null; type: string | null; description: string | null }[];
    }
  | { kind: "destroyTable"; tableId: string; status: "removed"; cascade: true }
  | {
      kind: "createField";
      tableId: string;
      fieldId: string;
      name: string | null;
      type: string | null;
      description: string | null;
    }
  | {
      kind: "updateField";
      tableId: string;
      fieldId: string;
      set: { name?: string; type?: string; description?: string | null };
      log: WireSchemaUpdateLog;
    }
  | { kind: "destroyField"; tableId: string; fieldId: string; status: "removed"; cascade: true }
  | {
      kind: "updateTableMetadata";
      tableId: string;
      set: { name?: string; description?: string | null };
      logs: WireSchemaUpdateLog[];
    }
  | { kind: "updateView"; tableId: string; viewId: string; change: unknown };

export type RecordWrite =
  | {
      kind: "createRecord";
      tableId: string;
      recordId: string;
      createdTime: string | null;
      cells: Record<string, unknown>;
    }
  | {
      kind: "updateCell";
      tableId: string;
      recordId: string;
      fieldId: string;
      value: unknown;
      modifiedTime: string | null;
      log: ({ oldValue: unknown } & WireAttribution) | null;
    }
  | { kind: "destroyRecord"; tableId: string; recordId: string; status: "deleted" };

// ── Request parsing (route body → typed op) ──────────────────────────────────

export interface IncrementalCounts {
  created: number;
  updated: number;
  deleted: number;
  reconciledRecords: number;
}

export type IncrementalApplyRequest =
  | { op: "open-base-run"; backupRunId: string; baseId: string }
  | {
      op: "complete-base-run";
      baseRunId: string;
      status: "succeeded" | "failed";
      counts: IncrementalCounts;
      errorMessage?: string;
    }
  | { op: "apply-schema-events"; baseRunId: string; baseId: string; writes: SchemaWrite[] }
  | { op: "apply-record-events"; baseRunId: string; baseId: string; writes: RecordWrite[] }
  | { op: "get-stored-records"; tableId: string; recordIds: string[] }
  | { op: "insert-schema-version"; baseRunId: string; baseId: string; schemaHash: string; schemaJson: unknown }
  | { op: "get-applied-schema-state"; baseId: string }
  | { op: "regenerate-views"; tableIds: string[] }
  | { op: "list-stored-record-ids"; tableId: string }
  | { op: "list-table-ids"; baseId: string };

export type ParseResult =
  | { ok: true; req: IncrementalApplyRequest }
  | { ok: false; reason: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isNullableStr = (v: unknown): v is string | null => v === null || typeof v === "string";
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const fail = (reason: string): ParseResult => ({ ok: false, reason });

function isWireLog(v: unknown): v is WireSchemaUpdateLog {
  if (!isObj(v)) return false;
  return (
    (v.changeType === "name" || v.changeType === "description" || v.changeType === "type" || v.changeType === "config") &&
    typeof v.breaksData === "boolean" &&
    isNullableStr(v.actionSource) &&
    isNullableStr(v.actor)
  );
}

function isSchemaWrite(v: unknown): v is SchemaWrite {
  if (!isObj(v)) return false;
  switch (v.kind) {
    case "createTable":
      return (
        isStr(v.tableId) &&
        isNullableStr(v.name) &&
        isNullableStr(v.description) &&
        Array.isArray(v.fields) &&
        v.fields.every(
          (f) => isObj(f) && isStr(f.fieldId) && isNullableStr(f.name) && isNullableStr(f.type) && isNullableStr(f.description),
        )
      );
    case "destroyTable":
      return isStr(v.tableId);
    case "createField":
      return isStr(v.tableId) && isStr(v.fieldId) && isNullableStr(v.name) && isNullableStr(v.type) && isNullableStr(v.description);
    case "updateField":
      return isStr(v.tableId) && isStr(v.fieldId) && isObj(v.set) && isWireLog(v.log);
    case "destroyField":
      return isStr(v.tableId) && isStr(v.fieldId);
    case "updateTableMetadata":
      return isStr(v.tableId) && isObj(v.set) && Array.isArray(v.logs) && v.logs.every(isWireLog);
    case "updateView":
      return isStr(v.tableId) && isStr(v.viewId);
    default:
      return false;
  }
}

function isRecordWrite(v: unknown): v is RecordWrite {
  if (!isObj(v)) return false;
  switch (v.kind) {
    case "createRecord":
      return isStr(v.tableId) && isStr(v.recordId) && isNullableStr(v.createdTime) && isObj(v.cells);
    case "updateCell":
      return (
        isStr(v.tableId) &&
        isStr(v.recordId) &&
        isStr(v.fieldId) &&
        isNullableStr(v.modifiedTime) &&
        (v.log === null || (isObj(v.log) && isNullableStr(v.log.actionSource) && isNullableStr(v.log.actor)))
      );
    case "destroyRecord":
      return isStr(v.tableId) && isStr(v.recordId);
    default:
      return false;
  }
}

function isCounts(v: unknown): v is IncrementalCounts {
  return (
    isObj(v) && isNum(v.created) && isNum(v.updated) && isNum(v.deleted) && isNum(v.reconciledRecords)
  );
}

/** Parse + validate the incremental-apply route body. Tolerant of extra keys. */
export function parseIncrementalApplyBody(raw: unknown): ParseResult {
  if (!isObj(raw)) return fail("body_not_object");
  const b = raw;
  switch (b.op) {
    case "open-base-run":
      if (!isStr(b.backupRunId) || !UUID_RE.test(b.backupRunId)) return fail("bad_backup_run_id");
      if (!isStr(b.baseId)) return fail("bad_base_id");
      return { ok: true, req: { op: "open-base-run", backupRunId: b.backupRunId, baseId: b.baseId } };

    case "complete-base-run": {
      if (!isStr(b.baseRunId) || !UUID_RE.test(b.baseRunId)) return fail("bad_base_run_id");
      if (b.status !== "succeeded" && b.status !== "failed") return fail("bad_status");
      if (!isCounts(b.counts)) return fail("bad_counts");
      const errorMessage = typeof b.errorMessage === "string" ? b.errorMessage : undefined;
      return {
        ok: true,
        req: {
          op: "complete-base-run",
          baseRunId: b.baseRunId,
          status: b.status,
          counts: b.counts,
          ...(errorMessage !== undefined ? { errorMessage } : {}),
        },
      };
    }

    case "apply-schema-events": {
      if (!isStr(b.baseRunId) || !UUID_RE.test(b.baseRunId)) return fail("bad_base_run_id");
      if (!isStr(b.baseId)) return fail("bad_base_id");
      if (!Array.isArray(b.writes) || !b.writes.every(isSchemaWrite)) return fail("bad_schema_writes");
      return { ok: true, req: { op: "apply-schema-events", baseRunId: b.baseRunId, baseId: b.baseId, writes: b.writes } };
    }

    case "apply-record-events": {
      if (!isStr(b.baseRunId) || !UUID_RE.test(b.baseRunId)) return fail("bad_base_run_id");
      if (!isStr(b.baseId)) return fail("bad_base_id");
      if (!Array.isArray(b.writes) || !b.writes.every(isRecordWrite)) return fail("bad_record_writes");
      return { ok: true, req: { op: "apply-record-events", baseRunId: b.baseRunId, baseId: b.baseId, writes: b.writes } };
    }

    case "get-stored-records":
      if (!isStr(b.tableId)) return fail("bad_table_id");
      if (!isStrArray(b.recordIds)) return fail("bad_record_ids");
      return { ok: true, req: { op: "get-stored-records", tableId: b.tableId, recordIds: b.recordIds } };

    case "insert-schema-version":
      if (!isStr(b.baseRunId) || !UUID_RE.test(b.baseRunId)) return fail("bad_base_run_id");
      if (!isStr(b.baseId)) return fail("bad_base_id");
      if (!isStr(b.schemaHash)) return fail("bad_schema_hash");
      if (b.schemaJson === undefined) return fail("bad_schema_json");
      return {
        ok: true,
        req: { op: "insert-schema-version", baseRunId: b.baseRunId, baseId: b.baseId, schemaHash: b.schemaHash, schemaJson: b.schemaJson },
      };

    case "get-applied-schema-state":
      if (!isStr(b.baseId)) return fail("bad_base_id");
      return { ok: true, req: { op: "get-applied-schema-state", baseId: b.baseId } };

    case "regenerate-views":
      if (!isStrArray(b.tableIds)) return fail("bad_table_ids");
      return { ok: true, req: { op: "regenerate-views", tableIds: b.tableIds } };

    case "list-stored-record-ids":
      if (!isStr(b.tableId)) return fail("bad_table_id");
      return { ok: true, req: { op: "list-stored-record-ids", tableId: b.tableId } };

    case "list-table-ids":
      if (!isStr(b.baseId)) return fail("bad_base_id");
      return { ok: true, req: { op: "list-table-ids", baseId: b.baseId } };

    default:
      return fail("unknown_op");
  }
}

// ── Schema-write planning ────────────────────────────────────────────────────

export interface SchemaUpdateRowPlan {
  entityType: "table" | "field";
  entityId: string;
  tableId: string | null;
  changeType: string;
  beforeValue: unknown;
  afterValue: unknown;
  breaksData: boolean;
  actionSource: string | null;
  actor: string | null;
}

export type SchemaPlanOp =
  | { op: "upsertTable"; tableId: string; name: string; description: string | null }
  | { op: "upsertField"; fieldId: string; tableId: string; name: string; type: string; description: string | null }
  | { op: "removeTableCascade"; tableId: string }
  | { op: "removeField"; fieldId: string; tableId: string }
  | { op: "patchTable"; tableId: string; set: { name?: string; description?: string | null } }
  | { op: "patchField"; fieldId: string; tableId: string; set: { name?: string; type?: string; description?: string | null } }
  | { op: "logSchemaUpdate"; row: SchemaUpdateRowPlan };

export interface SchemaPlan {
  ops: SchemaPlanOp[];
  /** updateView writes skipped (Enterprise view capture not enforced yet). */
  skippedViews: number;
}

const logRow = (
  entityType: "table" | "field",
  entityId: string,
  tableId: string,
  log: WireSchemaUpdateLog,
): SchemaPlanOp => ({
  op: "logSchemaUpdate",
  row: {
    entityType,
    entityId,
    tableId,
    changeType: log.changeType,
    beforeValue: log.beforeValue,
    afterValue: log.afterValue,
    breaksData: log.breaksData,
    actionSource: log.actionSource,
    actor: log.actor,
  },
});

/** Translate ordered SchemaWrite[] into ordered plan ops (order preserved). */
export function planSchemaWrites(writes: SchemaWrite[]): SchemaPlan {
  const ops: SchemaPlanOp[] = [];
  let skippedViews = 0;

  for (const w of writes) {
    switch (w.kind) {
      case "createTable":
        ops.push({ op: "upsertTable", tableId: w.tableId, name: w.name ?? "", description: w.description });
        for (const f of w.fields) {
          ops.push({
            op: "upsertField",
            fieldId: f.fieldId,
            tableId: w.tableId,
            name: f.name ?? "",
            type: f.type ?? "unknown",
            description: f.description,
          });
        }
        break;
      case "destroyTable":
        ops.push({ op: "removeTableCascade", tableId: w.tableId });
        break;
      case "createField":
        ops.push({
          op: "upsertField",
          fieldId: w.fieldId,
          tableId: w.tableId,
          name: w.name ?? "",
          type: w.type ?? "unknown",
          description: w.description,
        });
        break;
      case "updateField":
        if (Object.keys(w.set).length > 0) {
          ops.push({ op: "patchField", fieldId: w.fieldId, tableId: w.tableId, set: w.set });
        }
        ops.push(logRow("field", w.fieldId, w.tableId, w.log));
        break;
      case "destroyField":
        ops.push({ op: "removeField", fieldId: w.fieldId, tableId: w.tableId });
        break;
      case "updateTableMetadata":
        if (Object.keys(w.set).length > 0) {
          ops.push({ op: "patchTable", tableId: w.tableId, set: w.set });
        }
        for (const log of w.logs) ops.push(logRow("table", w.tableId, w.tableId, log));
        break;
      case "updateView":
        skippedViews += 1;
        break;
    }
  }

  return { ops, skippedViews };
}

// ── Record-write planning ────────────────────────────────────────────────────

export type RecordPlanOp =
  | {
      op: "upsertRecord";
      recordId: string;
      tableId: string;
      createdTime: string | null;
      /** fieldId → JSON-encoded value. Sparse: empty-encoding cells dropped. */
      cells: Record<string, string>;
    }
  | {
      op: "upsertCell";
      recordId: string;
      tableId: string;
      fieldId: string;
      /** JSON-encoded value, or null for a cleared cell. */
      value: string | null;
      modifiedTime: string | null;
    }
  | {
      op: "logRecordUpdate";
      recordId: string;
      tableId: string;
      fieldId: string;
      /** Superseded (old) JSON-encoded value. */
      oldValue: string | null;
      actionSource: string | null;
      actor: string | null;
    }
  | { op: "deleteRecord"; recordId: string; tableId: string };

export interface RecordPlan {
  ops: RecordPlanOp[];
}

/** Translate ordered RecordWrite[] into ordered plan ops (order preserved). */
export function planRecordWrites(writes: RecordWrite[]): RecordPlan {
  const ops: RecordPlanOp[] = [];

  for (const w of writes) {
    switch (w.kind) {
      case "createRecord": {
        const cells: Record<string, string> = {};
        for (const [fieldId, raw] of Object.entries(w.cells)) {
          const enc = encodeCellValue(raw);
          if (enc !== null) cells[fieldId] = enc; // sparse-until-first-value
        }
        ops.push({ op: "upsertRecord", recordId: w.recordId, tableId: w.tableId, createdTime: w.createdTime, cells });
        break;
      }
      case "updateCell":
        ops.push({
          op: "upsertCell",
          recordId: w.recordId,
          tableId: w.tableId,
          fieldId: w.fieldId,
          value: encodeCellValue(w.value),
          modifiedTime: w.modifiedTime,
        });
        if (w.log) {
          ops.push({
            op: "logRecordUpdate",
            recordId: w.recordId,
            tableId: w.tableId,
            fieldId: w.fieldId,
            oldValue: encodeCellValue(w.log.oldValue),
            actionSource: w.log.actionSource,
            actor: w.log.actor,
          });
        }
        break;
      case "destroyRecord":
        ops.push({ op: "deleteRecord", recordId: w.recordId, tableId: w.tableId });
        break;
    }
  }

  return { ops };
}

// ── Read-seam shaping ────────────────────────────────────────────────────────

export interface StoredRecordState {
  /** fieldId → decoded raw value. Key present with null = cleared cell. */
  cells: Record<string, unknown>;
}

/**
 * Shape bo_at_records + bo_at_record_field_data rows into the workflows-side
 * StoredRecordState map. A record with a row but no cells is PRESENT with empty
 * cells (its create was already applied — the diff must not re-create it); a
 * record with no row is simply absent. Stored values are JSON-encoded text;
 * an unparsable value passes through raw rather than failing the read.
 */
export function decodeStoredCells(
  recordRows: { recordId: string }[],
  cellRows: { recordId: string; fieldId: string; value: string | null }[],
): Record<string, StoredRecordState> {
  const out: Record<string, StoredRecordState> = {};
  for (const r of recordRows) out[r.recordId] = { cells: {} };
  for (const c of cellRows) {
    const rec = (out[c.recordId] ??= { cells: {} });
    if (c.value === null) {
      rec.cells[c.fieldId] = null;
    } else {
      try {
        rec.cells[c.fieldId] = JSON.parse(c.value);
      } catch {
        rec.cells[c.fieldId] = c.value;
      }
    }
  }
  return out;
}

export interface AppliedSchemaState {
  tables: Record<string, { fields: Record<string, { type: string }> }>;
}

/**
 * Shape active bo_at_tables + bo_at_fields rows into the applied-state map the
 * workflows verification compares against the meta fetch. Orphan fields (table
 * not in the active set) are dropped so the table-id comparison stays exact.
 */
export function buildAppliedSchemaState(
  tableRows: { tableId: string }[],
  fieldRows: { fieldId: string; tableId: string; type: string }[],
): AppliedSchemaState {
  const tables: AppliedSchemaState["tables"] = {};
  for (const t of tableRows) tables[t.tableId] = { fields: {} };
  for (const f of fieldRows) {
    const t = tables[f.tableId];
    if (t) t.fields[f.fieldId] = { type: f.type };
  }
  return { tables };
}
