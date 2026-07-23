// Incremental-backup orchestration (openspec/changes/workflows-instant-webhook).
//
// Payloads-API-primary: pulls webhook payloads from the subscription's cursor,
// applies them in baseTransactionNumber order — schema events BEFORE record
// events within each payload (incoming cellValuesByFieldId may reference
// fields created in the same transaction) — and advances the cursor via the
// engine callback after each durably-applied batch. When the payload stream is
// suspect (drift, verification mismatch, INTERNAL_ERROR payloads, a table
// created this pass, or the server-set `reconcile` flag) a records-API
// modifiedTime reconciliation catch-all runs after the payload pass.
//
// Pure + dep-injected per CLAUDE.md §6: this module NEVER talks to a DB or the
// network directly. Per-space writes go through a narrow injected interface
// (openBaseRun / applySchemaEvents / applyRecordEvents / …) — the engine
// currently brokers per-space writes, and the task wrapper wires the interface
// to the real transport when server-instant-webhook Phase D lands. Airtable
// access (payload polls, meta fetch, reconciliation paging) is likewise
// injected so tests drive fixture streams with no real API.
//
// Write-shape semantics mirror the per-space model
// (packages/db-schema/src/space/pg.ts + openspec/changes/system-per-space-db):
//   - destroys are CONFIDENT removals: status='removed' (+cascade) for
//     tables/fields, status='deleted' for records — never 'unknown'.
//   - changed cells log the superseded value FROM OUR STORED rfd value; the
//     payload's `previous` is used only for drift detection, never written.
//   - value-equality guard: replaying an already-applied payload is a no-op
//     (no cell write, no log) — mid-batch retries are idempotent.
//   - description writes touch ONLY `description` — never ai_description /
//     description_override (they'd clobber AI/manual annotations).
//   - attribution (action_source + actor from actionMetadata) rides every
//     payload-derived update log; reconciliation writes carry NULL attribution.

import { createHash } from "node:crypto";
import {
  PayloadsCursorExpiredError,
  type LogFn,
  type PayloadChangedRecord,
  type PayloadCreatedRecord,
  type PayloadFieldSchema,
  type PayloadsPage,
  type WebhookPayload,
} from "./_lib/airtable-payloads";
import type { AirtableRecordsPage, AirtableSchema } from "./_lib/airtable-client";

// ── Input / result ───────────────────────────────────────────────────────────

/** Task payload shape — enqueued by the SpaceDO poll tick
 *  (openspec/changes/server-instant-webhook Phase C). */
export interface IncrementalBackupInput {
  runId: string;
  spaceId: string;
  subscriptionId: string;
  baseId: string;
  connectionId: string;
  /** The subscription's payload_cursor at enqueue time. */
  cursor: number;
  /** Server sets true when last_reconciled_at exceeds the reconciliation cadence. */
  reconcile: boolean;
}

export type IncrementalBackupStatus = "succeeded" | "fallback_to_full" | "failed";

export interface IncrementalBackupResult {
  status: IncrementalBackupStatus;
  /** Records created from payloads (createdRecordsById + created-table recordsById). */
  created: number;
  /** Records with ≥1 applied cell change from payloads. */
  updated: number;
  /** Records destroyed by payloads. */
  deleted: number;
  /** Reconciliation-path corrections (upserts + sweep deletions) — kept
   *  separate so payload-stream reliability stays observable in run detail. */
  reconciledRecords: number;
  /** stored-vs-payload-previous mismatches observed during the payload pass. */
  driftCount: number;
  payloadsApplied: number;
  reconcileRan: boolean;
  /** Last cursor durably applied + POSTed (input cursor when nothing applied). */
  finalCursor: number;
  /** Set when status = fallback_to_full: cursor_expired | INVALID_HOOK | INVALID_FILTERS. */
  fallbackReason?: string;
  errorMessage?: string;
}

// ── Injected write shapes (engine-brokered per-space writes) ────────────────

/** Attribution threaded onto payload-derived update logs; null on reconciliation. */
export interface UpdateAttribution {
  actionSource: string | null;
  actor: string | null;
}

/** One bo_at_schema_updates row (modifications only; add/remove are lifecycle). */
export interface SchemaUpdateLog extends UpdateAttribution {
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
      /** Only the keys that changed — a description-only change carries only
       *  `description` (never touches ai_description/description_override). */
      set: { name?: string; type?: string; description?: string | null };
      log: SchemaUpdateLog;
    }
  | { kind: "destroyField"; tableId: string; fieldId: string; status: "removed"; cascade: true }
  | {
      kind: "updateTableMetadata";
      tableId: string;
      set: { name?: string; description?: string | null };
      logs: SchemaUpdateLog[];
    }
  | {
      kind: "updateView";
      tableId: string;
      viewId: string;
      /** Raw payload change — applied only under Enterprise view capture. */
      change: unknown;
    };

export type RecordWrite =
  | {
      kind: "createRecord";
      tableId: string;
      recordId: string;
      createdTime: string | null;
      /** fieldId → raw Airtable value. Sparse: only populated cells. First
       *  population logs nothing. */
      cells: Record<string, unknown>;
    }
  | {
      kind: "updateCell";
      tableId: string;
      recordId: string;
      fieldId: string;
      value: unknown;
      modifiedTime: string | null;
      /** Superseded-value log from OUR stored rfd value; null when the cell
       *  had no rfd row (create-without-log). */
      log: ({ oldValue: unknown } & UpdateAttribution) | null;
    }
  | { kind: "destroyRecord"; tableId: string; recordId: string; status: "deleted" };

/** Stored per-space state for one record, as returned by the read seam. */
export interface StoredRecordState {
  /** fieldId → stored raw value. A missing key = no rfd row (never populated). */
  cells: Record<string, unknown>;
}

/** Applied per-space schema state used to verify the end-of-pass meta fetch. */
export interface AppliedSchemaState {
  tables: Record<string, { fields: Record<string, { type: string }> }>;
}

/**
 * Narrow engine-brokered per-space interface. The wrapper wires this to the
 * real transport once server-instant-webhook Phase D lands; tests inject a
 * recording fake and assert the emitted write shapes.
 */
export interface IncrementalDb {
  /** Opens the pass as a bo_at_base_runs row with run_type='incremental'. */
  openBaseRun(args: {
    backupRunId: string;
    baseId: string;
    runType: "incremental";
  }): Promise<{ baseRunId: string }>;
  completeBaseRun(args: {
    baseRunId: string;
    status: "succeeded" | "failed";
    counts: { created: number; updated: number; deleted: number; reconciledRecords: number };
    errorMessage?: string;
  }): Promise<void>;
  applySchemaEvents(baseRunId: string, writes: SchemaWrite[]): Promise<void>;
  applyRecordEvents(baseRunId: string, writes: RecordWrite[]): Promise<void>;
  /** Read seam for the changed-record diff (superseded values + idempotency). */
  getStoredRecords(
    tableId: string,
    recordIds: string[],
  ): Promise<Record<string, StoredRecordState | undefined>>;
  /** Hash-deduped bo_at_schema_versions insert. */
  insertSchemaVersion(args: {
    baseRunId: string;
    schemaHash: string;
    schemaJson: unknown;
  }): Promise<{ inserted: boolean }>;
  getAppliedSchemaState(): Promise<AppliedSchemaState>;
  /** Regenerate per-table query views (+ refresh matviews) — retypes change the safe-casts. */
  regenerateViews(tableIds: string[]): Promise<void>;
  /** Active stored record ids for the reconciliation deletion sweep. */
  listStoredRecordIds(tableId: string): Promise<string[]>;
  /** Active stored table ids for the reconciliation pass. */
  listTableIds(): Promise<string[]>;
}

export interface IncrementalEngineCallbacks {
  /** POST /api/internal/webhook-subscriptions/:id/cursor after each durably-applied batch. */
  postCursor(cursor: number): Promise<void>;
  /** POST /api/internal/webhook-subscriptions/:id/fallback — full-backup fallback. */
  postFallback(reason: string): Promise<void>;
}

export interface IncrementalAirtable {
  /** One payloads page from the given cursor; throws PayloadsCursorExpiredError on 7-day purge. */
  fetchPayloadsPage(cursor: number): Promise<PayloadsPage>;
  /** GET /v0/meta/bases/:baseId/tables — end-of-pass snapshot (schema passes only). */
  getBaseSchema(): Promise<AirtableSchema>;
  /** Records paging for the reconciliation catch-all. */
  listRecordsPage(
    tableId: string,
    opts: {
      offset?: string;
      filterByFormula?: string;
      returnFieldsByFieldId?: boolean;
      fields?: string[];
    },
  ): Promise<AirtableRecordsPage>;
}

export interface IncrementalBackupDeps {
  airtable: IncrementalAirtable;
  db: IncrementalDb;
  engine: IncrementalEngineCallbacks;
  now?: () => Date;
  /** Structured-log callback (no console.*). Default no-op. */
  log?: LogFn;
  /** Drift observations above this count flip the pass to reconcile. Default 0
   *  (any drift reconciles — payloads-stream misses are cheap to catch here). */
  driftThreshold?: number;
  /** Enterprise view capture — changedViewsById is skipped when false (default). */
  viewCaptureEnabled?: boolean;
  /** Reconciliation anchor (subscription's last_reconciled_at, ISO). Null/absent
   *  → reconciliation pages without a modifiedTime filter (full sweep). */
  lastReconciledAt?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
  );
  return `{${parts.join(",")}}`;
}

/** Key-order-independent sha256 of a schema snapshot (bo_at_schema_versions dedup). */
export function schemaHashOf(schema: unknown): string {
  return createHash("sha256").update(stableStringify(schema)).digest("hex");
}

/** Value-equality guard: JSON-value equality independent of key order. */
function valuesEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function extractAttribution(payload: WebhookPayload): UpdateAttribution {
  const source = payload.actionMetadata?.source ?? null;
  const user = payload.actionMetadata?.sourceMetadata?.user;
  const actor = user ? (user.email ?? user.name ?? user.id ?? null) : null;
  return { actionSource: source, actor };
}

const FALLBACK_CODES = new Set(["INVALID_HOOK", "INVALID_FILTERS"]);

interface Counters {
  created: number;
  updated: number;
  deleted: number;
  reconciledRecords: number;
  driftCount: number;
}

// ── Payload → write computation ──────────────────────────────────────────────

function fieldSchemaWritePatch(
  current: PayloadFieldSchema | undefined,
  previous: PayloadFieldSchema | undefined,
): {
  set: { name?: string; type?: string; description?: string | null };
  changeType: SchemaUpdateLog["changeType"];
  breaksData: boolean;
} {
  const set: { name?: string; type?: string; description?: string | null } = {};
  if (current?.type !== undefined) set.type = current.type;
  if (current?.name !== undefined) set.name = current.name;
  if (current?.description !== undefined) set.description = current.description;
  const retyped = current?.type !== undefined && current.type !== previous?.type;
  const changeType: SchemaUpdateLog["changeType"] = retyped
    ? "type"
    : current?.name !== undefined
      ? "name"
      : current?.description !== undefined
        ? "description"
        : "config";
  return { set, changeType, breaksData: retyped };
}

function computeSchemaWrites(
  payload: WebhookPayload,
  attribution: UpdateAttribution,
  viewCaptureEnabled: boolean,
  createdTables: Set<string>,
  affectedTables: Set<string>,
): SchemaWrite[] {
  const writes: SchemaWrite[] = [];

  for (const [tableId, created] of Object.entries(payload.createdTablesById ?? {})) {
    writes.push({
      kind: "createTable",
      tableId,
      name: created.metadata?.name ?? null,
      description: created.metadata?.description ?? null,
      fields: Object.entries(created.fieldsById ?? {}).map(([fieldId, f]) => ({
        fieldId,
        name: f?.name ?? null,
        type: f?.type ?? null,
        description: f?.description ?? null,
      })),
    });
    createdTables.add(tableId);
    affectedTables.add(tableId);
  }

  for (const tableId of payload.destroyedTableIds ?? []) {
    // Explicit destroy events are a CONFIDENT removal source — status='removed'
    // directly (never 'unknown'), cascading to child fields/records engine-side.
    writes.push({ kind: "destroyTable", tableId, status: "removed", cascade: true });
    affectedTables.add(tableId);
  }

  for (const [tableId, changes] of Object.entries(payload.changedTablesById ?? {})) {
    for (const [fieldId, f] of Object.entries(changes.createdFieldsById ?? {})) {
      writes.push({
        kind: "createField",
        tableId,
        fieldId,
        name: f?.name ?? null,
        type: f?.type ?? null,
        description: f?.description ?? null,
      });
      affectedTables.add(tableId);
    }
    for (const [fieldId, change] of Object.entries(changes.changedFieldsById ?? {})) {
      const { set, changeType, breaksData } = fieldSchemaWritePatch(
        change?.current,
        change?.previous,
      );
      writes.push({
        kind: "updateField",
        tableId,
        fieldId,
        set,
        // Schema logs use the payload's previous/current as before/after —
        // unlike record cells, the per-space fields row IS the applied state.
        log: {
          changeType,
          beforeValue: change?.previous ?? null,
          afterValue: change?.current ?? null,
          breaksData,
          ...attribution,
        },
      });
      affectedTables.add(tableId);
    }
    for (const fieldId of changes.destroyedFieldIds ?? []) {
      writes.push({ kind: "destroyField", tableId, fieldId, status: "removed", cascade: true });
      affectedTables.add(tableId);
    }
    if (changes.changedMetadata) {
      const cur = changes.changedMetadata.current ?? {};
      const prev = changes.changedMetadata.previous ?? {};
      const set: { name?: string; description?: string | null } = {};
      const logs: SchemaUpdateLog[] = [];
      if (cur.name !== undefined) {
        set.name = cur.name;
        logs.push({
          changeType: "name",
          beforeValue: prev.name ?? null,
          afterValue: cur.name,
          breaksData: false,
          ...attribution,
        });
      }
      if (cur.description !== undefined) {
        // Touches ONLY `description` — never ai_description/description_override.
        set.description = cur.description;
        logs.push({
          changeType: "description",
          beforeValue: prev.description ?? null,
          afterValue: cur.description,
          breaksData: false,
          ...attribution,
        });
      }
      writes.push({ kind: "updateTableMetadata", tableId, set, logs });
      affectedTables.add(tableId);
    }
    if (changes.changedViewsById && viewCaptureEnabled) {
      for (const [viewId, change] of Object.entries(changes.changedViewsById)) {
        writes.push({ kind: "updateView", tableId, viewId, change });
        affectedTables.add(tableId);
      }
    }
  }

  return writes;
}

async function computeRecordWrites(
  db: IncrementalDb,
  payload: WebhookPayload,
  attribution: UpdateAttribution,
  counters: Counters,
  log: LogFn,
): Promise<RecordWrite[]> {
  const writes: RecordWrite[] = [];
  const timestamp = payload.timestamp ?? null;

  // Records arriving with a created table go through the ordinary record path.
  for (const [tableId, created] of Object.entries(payload.createdTablesById ?? {})) {
    for (const [recordId, rec] of Object.entries(created.recordsById ?? {})) {
      writes.push(createRecordWrite(tableId, recordId, rec));
      counters.created += 1;
    }
  }

  for (const [tableId, changes] of Object.entries(payload.changedTablesById ?? {})) {
    for (const [recordId, rec] of Object.entries(changes.createdRecordsById ?? {})) {
      writes.push(createRecordWrite(tableId, recordId, rec));
      counters.created += 1;
    }

    const changedIds = Object.keys(changes.changedRecordsById ?? {});
    if (changedIds.length > 0) {
      const stored = await db.getStoredRecords(tableId, changedIds);
      for (const [recordId, change] of Object.entries(changes.changedRecordsById ?? {})) {
        const storedRec = stored[recordId];
        if (!storedRec) {
          // The payload stream never showed us this record's create — upsert
          // it whole (no logs; it's a first population from our side).
          writes.push({
            kind: "createRecord",
            tableId,
            recordId,
            createdTime: null,
            cells: change?.current?.cellValuesByFieldId ?? {},
          });
          counters.created += 1;
          continue;
        }
        const cellWrites = diffChangedRecord(
          tableId,
          recordId,
          change,
          storedRec,
          attribution,
          timestamp,
          counters,
          log,
        );
        if (cellWrites.length > 0) {
          counters.updated += 1;
          writes.push(...cellWrites);
        }
      }
    }

    for (const recordId of changes.destroyedRecordIds ?? []) {
      writes.push({ kind: "destroyRecord", tableId, recordId, status: "deleted" });
      counters.deleted += 1;
    }
  }

  return writes;
}

function createRecordWrite(
  tableId: string,
  recordId: string,
  rec: PayloadCreatedRecord | undefined,
): RecordWrite {
  return {
    kind: "createRecord",
    tableId,
    recordId,
    createdTime: rec?.createdTime ?? null,
    cells: rec?.cellValuesByFieldId ?? {},
  };
}

function diffChangedRecord(
  tableId: string,
  recordId: string,
  change: PayloadChangedRecord | undefined,
  storedRec: StoredRecordState,
  attribution: UpdateAttribution,
  timestamp: string | null,
  counters: Counters,
  log: LogFn,
): RecordWrite[] {
  const writes: RecordWrite[] = [];
  const current = change?.current?.cellValuesByFieldId ?? {};
  const previous = change?.previous?.cellValuesByFieldId;

  for (const [fieldId, newValue] of Object.entries(current)) {
    const hasStoredCell = Object.prototype.hasOwnProperty.call(storedRec.cells, fieldId);
    const storedValue = storedRec.cells[fieldId];

    // Drift detection: the payload's `previous` claim vs OUR stored value.
    // The payload previous is NEVER written anywhere.
    if (previous && Object.prototype.hasOwnProperty.call(previous, fieldId) && hasStoredCell) {
      if (!valuesEqual(previous[fieldId], storedValue)) {
        counters.driftCount += 1;
        log({ event: "payload_previous_drift", tableId, recordId, fieldId });
      }
    }

    // Value-equality idempotency guard: replays are no-ops (no write, no log).
    if (hasStoredCell && valuesEqual(storedValue, newValue)) continue;

    writes.push({
      kind: "updateCell",
      tableId,
      recordId,
      fieldId,
      value: newValue,
      modifiedTime: timestamp,
      // Superseded value from OUR stored rfd row; no rfd row → create silently.
      log: hasStoredCell ? { oldValue: storedValue, ...attribution } : null,
    });
  }

  // `unchanged` cell values are never applied — sampled for drift only.
  const unchanged = change?.unchanged?.cellValuesByFieldId ?? {};
  for (const [fieldId, claimed] of Object.entries(unchanged)) {
    if (
      Object.prototype.hasOwnProperty.call(storedRec.cells, fieldId) &&
      !valuesEqual(storedRec.cells[fieldId], claimed)
    ) {
      counters.driftCount += 1;
      log({ event: "unchanged_value_drift", tableId, recordId, fieldId });
    }
  }

  return writes;
}

// ── End-of-pass schema verification ──────────────────────────────────────────

/** Compare the meta-fetched schema against the payload-applied state on
 *  table/field ids + field types. A disagreement = payload-stream miss. */
function schemaMatchesApplied(meta: AirtableSchema, applied: AppliedSchemaState): boolean {
  const metaTableIds = meta.tables.map((t) => t.id).sort();
  const appliedTableIds = Object.keys(applied.tables).sort();
  if (metaTableIds.join(",") !== appliedTableIds.join(",")) return false;
  for (const table of meta.tables) {
    const appliedTable = applied.tables[table.id];
    if (!appliedTable) return false;
    const metaFieldIds = table.fields.map((f) => f.id).sort();
    const appliedFieldIds = Object.keys(appliedTable.fields).sort();
    if (metaFieldIds.join(",") !== appliedFieldIds.join(",")) return false;
    for (const field of table.fields) {
      if (appliedTable.fields[field.id]?.type !== field.type) return false;
    }
  }
  return true;
}

// ── Reconciliation catch-all ─────────────────────────────────────────────────

const NULL_ATTRIBUTION: UpdateAttribution = { actionSource: null, actor: null };

async function reconcileTable(
  deps: IncrementalBackupDeps,
  baseRunId: string,
  tableId: string,
  anchorIso: string | null,
  counters: Counters,
): Promise<void> {
  const { airtable, db } = deps;

  // 1. modifiedTime paging: upsert source records our DB disagrees with.
  //    Tables created this pass (or a null anchor) page WITHOUT the filter —
  //    their payload recordsById may be partial, so they get a full fill.
  let offset: string | undefined;
  do {
    const page = await airtable.listRecordsPage(tableId, {
      ...(offset ? { offset } : {}),
      returnFieldsByFieldId: true,
      ...(anchorIso
        ? { filterByFormula: `IS_AFTER(LAST_MODIFIED_TIME(), "${anchorIso}")` }
        : {}),
    });
    const ids = page.records.map((r) => r.id);
    const stored = ids.length > 0 ? await db.getStoredRecords(tableId, ids) : {};
    const writes: RecordWrite[] = [];
    for (const rec of page.records) {
      const storedRec = stored[rec.id];
      let touched = false;
      if (!storedRec) {
        writes.push({
          kind: "createRecord",
          tableId,
          recordId: rec.id,
          createdTime: rec.createdTime ?? null,
          cells: rec.fields,
        });
        touched = true;
      } else {
        for (const [fieldId, value] of Object.entries(rec.fields)) {
          const hasStoredCell = Object.prototype.hasOwnProperty.call(storedRec.cells, fieldId);
          if (hasStoredCell && valuesEqual(storedRec.cells[fieldId], value)) continue;
          writes.push({
            kind: "updateCell",
            tableId,
            recordId: rec.id,
            fieldId,
            value,
            modifiedTime: null,
            // Reconciliation-sourced writes carry NULL attribution.
            log: hasStoredCell
              ? { oldValue: storedRec.cells[fieldId], ...NULL_ATTRIBUTION }
              : null,
          });
          touched = true;
        }
        // A modified record whose stored cell is absent from the source has
        // been cleared — Airtable omits empty cells from record payloads.
        for (const [fieldId, storedValue] of Object.entries(storedRec.cells)) {
          if (Object.prototype.hasOwnProperty.call(rec.fields, fieldId)) continue;
          if (storedValue === null || storedValue === undefined) continue;
          writes.push({
            kind: "updateCell",
            tableId,
            recordId: rec.id,
            fieldId,
            value: null,
            modifiedTime: null,
            log: { oldValue: storedValue, ...NULL_ATTRIBUTION },
          });
          touched = true;
        }
      }
      if (touched) counters.reconciledRecords += 1;
    }
    if (writes.length > 0) await db.applyRecordEvents(baseRunId, writes);
    offset = page.offset;
  } while (offset);

  // 2. Deletion sweep: modifiedTime paging cannot observe deletions, so list
  //    source record ids (fields-free) and mark stored rows absent from the
  //    source as deleted.
  const sourceIds = new Set<string>();
  let sweepOffset: string | undefined;
  do {
    const page = await airtable.listRecordsPage(tableId, {
      ...(sweepOffset ? { offset: sweepOffset } : {}),
      fields: [],
    });
    for (const rec of page.records) sourceIds.add(rec.id);
    sweepOffset = page.offset;
  } while (sweepOffset);
  const storedIds = await db.listStoredRecordIds(tableId);
  const deletions: RecordWrite[] = storedIds
    .filter((id) => !sourceIds.has(id))
    .map((recordId) => ({ kind: "destroyRecord", tableId, recordId, status: "deleted" }));
  if (deletions.length > 0) {
    await db.applyRecordEvents(baseRunId, deletions);
    counters.reconciledRecords += deletions.length;
  }
}

// ── Main orchestration ───────────────────────────────────────────────────────

export async function runIncrementalBackup(
  input: IncrementalBackupInput,
  deps: IncrementalBackupDeps,
): Promise<IncrementalBackupResult> {
  const log: LogFn = deps.log ?? (() => {});
  const driftThreshold = deps.driftThreshold ?? 0;
  const counters: Counters = {
    created: 0,
    updated: 0,
    deleted: 0,
    reconciledRecords: 0,
    driftCount: 0,
  };

  const { baseRunId } = await deps.db.openBaseRun({
    backupRunId: input.runId,
    baseId: input.baseId,
    runType: "incremental",
  });

  let cursor = input.cursor;
  let payloadsApplied = 0;
  let reconcileNeeded = input.reconcile;
  let schemaEventsApplied = false;
  const createdTables = new Set<string>();
  const affectedTables = new Set<string>();

  const finish = async (
    status: IncrementalBackupStatus,
    extras: Partial<IncrementalBackupResult> = {},
  ): Promise<IncrementalBackupResult> => {
    await deps.db.completeBaseRun({
      baseRunId,
      status: status === "succeeded" ? "succeeded" : "failed",
      counts: {
        created: counters.created,
        updated: counters.updated,
        deleted: counters.deleted,
        reconciledRecords: counters.reconciledRecords,
      },
      ...(extras.fallbackReason ? { errorMessage: `fallback_to_full:${extras.fallbackReason}` } : {}),
      ...(extras.errorMessage ? { errorMessage: extras.errorMessage } : {}),
    });
    return {
      status,
      created: counters.created,
      updated: counters.updated,
      deleted: counters.deleted,
      reconciledRecords: counters.reconciledRecords,
      driftCount: counters.driftCount,
      payloadsApplied,
      reconcileRan: extras.reconcileRan ?? false,
      finalCursor: cursor,
      ...extras,
    };
  };

  try {
    // ── Payload pass (primary) ──────────────────────────────────────────────
    let mightHaveMore = true;
    while (mightHaveMore) {
      let page: PayloadsPage;
      try {
        page = await deps.airtable.fetchPayloadsPage(cursor);
      } catch (err) {
        if (err instanceof PayloadsCursorExpiredError) {
          // Cursor predates the 7-day payload retention: abort without partial
          // application; the server enqueues a full re-read.
          log({ event: "cursor_expired", cursor });
          await deps.engine.postFallback("cursor_expired");
          return await finish("fallback_to_full", { fallbackReason: "cursor_expired" });
        }
        throw err;
      }

      const ordered = [...page.payloads].sort(
        (a, b) => a.baseTransactionNumber - b.baseTransactionNumber,
      );
      for (const payload of ordered) {
        if (payload.error) {
          const code = payload.code ?? "UNKNOWN_ERROR";
          if (FALLBACK_CODES.has(code)) {
            // Webhook itself is broken — server re-creates it + full re-read.
            log({ event: "error_payload_fallback", code });
            await deps.engine.postFallback(code);
            return await finish("fallback_to_full", { fallbackReason: code });
          }
          // INTERNAL_ERROR (or unknown): the transaction is opaque — skip it
          // and let the reconciliation catch-all cover whatever it contained.
          log({ event: "error_payload_skipped", code });
          reconcileNeeded = true;
          continue;
        }

        const attribution = extractAttribution(payload);

        // Schema events apply BEFORE record events within each payload —
        // incoming cells may reference fields created in the same transaction.
        const schemaWrites = computeSchemaWrites(
          payload,
          attribution,
          deps.viewCaptureEnabled ?? false,
          createdTables,
          affectedTables,
        );
        if (schemaWrites.length > 0) {
          await deps.db.applySchemaEvents(baseRunId, schemaWrites);
          schemaEventsApplied = true;
        }

        const recordWrites = await computeRecordWrites(
          deps.db,
          payload,
          attribution,
          counters,
          log,
        );
        if (recordWrites.length > 0) {
          await deps.db.applyRecordEvents(baseRunId, recordWrites);
        }

        payloadsApplied += 1;
      }

      // Batch durably applied → advance the subscription cursor. The server's
      // monotonic guard 409s a stale value on replays; the wrapper's transport
      // treats that as success.
      if (page.cursor !== cursor) {
        await deps.engine.postCursor(page.cursor);
        cursor = page.cursor;
      }
      mightHaveMore = page.mightHaveMore;
    }

    if (counters.driftCount > driftThreshold) reconcileNeeded = true;

    // ── End-of-pass schema snapshot (only when schema events occurred) ──────
    // Record-only passes make ZERO extra Airtable API calls.
    if (schemaEventsApplied) {
      const meta = await deps.airtable.getBaseSchema();
      await deps.db.insertSchemaVersion({
        baseRunId,
        schemaHash: schemaHashOf(meta),
        schemaJson: meta,
      });
      const applied = await deps.db.getAppliedSchemaState();
      if (!schemaMatchesApplied(meta, applied)) {
        // The authoritative schema disagrees with what the payloads built —
        // a payload-stream miss. Reconcile to close the gap.
        log({ event: "schema_verification_mismatch" });
        reconcileNeeded = true;
      }
      await deps.db.regenerateViews([...affectedTables]);
    }

    // ── Reconciliation catch-all ────────────────────────────────────────────
    const reconcileRan = reconcileNeeded || createdTables.size > 0;
    if (reconcileRan) {
      const anchor = deps.lastReconciledAt ?? null;
      const tableIds = new Set([...(await deps.db.listTableIds()), ...createdTables]);
      for (const tableId of tableIds) {
        // Created-this-pass tables get a full fill regardless of the anchor —
        // their payload recordsById may be partial for large pasted-in tables.
        const tableAnchor = createdTables.has(tableId) ? null : anchor;
        await reconcileTable(deps, baseRunId, tableId, tableAnchor, counters);
      }
    }

    return await finish("succeeded", { reconcileRan });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    try {
      await deps.db.completeBaseRun({
        baseRunId,
        status: "failed",
        counts: {
          created: counters.created,
          updated: counters.updated,
          deleted: counters.deleted,
          reconciledRecords: counters.reconciledRecords,
        },
        errorMessage,
      });
    } catch {
      // Best-effort — the wrapper's completion POST + run reconciliation are
      // the safety nets for a base run stranded mid-state.
    }
    throw err;
  }
}

// ── Engine-callback transport (pure; used by the task wrapper) ──────────────

export interface CreateEngineCallbacksArgs {
  engineUrl: string;
  internalToken: string;
  subscriptionId: string;
  fetchImpl?: typeof fetch;
}

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

/**
 * Real HTTP transport for the two subscription callbacks
 * (openspec/changes/server-instant-webhook Phase D routes):
 *   POST /api/internal/webhook-subscriptions/:id/cursor   { cursor }
 *   POST /api/internal/webhook-subscriptions/:id/fallback { reason }
 * A 409 on the cursor POST is the server's monotonic guard rejecting a stale
 * value — expected on idempotent replays, treated as success.
 */
export function createEngineCallbacks(
  args: CreateEngineCallbacksArgs,
): IncrementalEngineCallbacks {
  const fetchFn = args.fetchImpl ?? fetch;
  const base = `${trimSlash(args.engineUrl)}/api/internal/webhook-subscriptions/${encodeURIComponent(args.subscriptionId)}`;
  const headers = {
    "x-internal-token": args.internalToken,
    "content-type": "application/json",
  };

  return {
    async postCursor(cursor: number): Promise<void> {
      const res = await fetchFn(`${base}/cursor`, {
        method: "POST",
        headers,
        body: JSON.stringify({ cursor }),
      });
      if (res.ok || res.status === 409) return;
      throw new Error(`webhook-subscription cursor callback returned ${res.status}`);
    },
    async postFallback(reason: string): Promise<void> {
      const res = await fetchFn(`${base}/fallback`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        throw new Error(`webhook-subscription fallback callback returned ${res.status}`);
      }
    },
  };
}

// ── Payloads-auth context transport (pure; used by the task wrapper) ─────────

/** Per-subscription auth + anchors the task payload deliberately omits
 *  (tokens must never ride Trigger.dev run history). Resolved at run start
 *  from POST /api/internal/webhook-subscriptions/:id/context
 *  (server-dynamic-mode Phase 4.1). */
export interface SubscriptionContext {
  /** Airtable's webhook id (ach…) — NOT our registry row uuid. */
  airtableWebhookId: string;
  baseId: string;
  /** Decrypted Connection access token (ConnectionDO /token gate, refresh-if-needed). */
  accessToken: string;
  /** Reconciliation anchor (subscription.last_reconciled_at, ISO) or null. */
  lastReconciledAt: string | null;
  /** The subscription's current payload_cursor. */
  cursor: number;
}

export interface FetchSubscriptionContextArgs {
  engineUrl: string;
  internalToken: string;
  subscriptionId: string;
  fetchImpl?: typeof fetch;
}

/** Throws on any non-2xx (409 token_unavailable included) — the wrapper's
 *  catch posts a failed completion and the next poll tick retries. */
export async function fetchSubscriptionContext(
  args: FetchSubscriptionContextArgs,
): Promise<SubscriptionContext> {
  const fetchFn = args.fetchImpl ?? fetch;
  const url = `${trimSlash(args.engineUrl)}/api/internal/webhook-subscriptions/${encodeURIComponent(args.subscriptionId)}/context`;
  const res = await fetchFn(url, {
    method: "POST",
    headers: {
      "x-internal-token": args.internalToken,
      "content-type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`webhook-subscription context resolution returned ${res.status}`);
  }
  const body = (await res.json()) as SubscriptionContext;
  return {
    airtableWebhookId: body.airtableWebhookId,
    baseId: body.baseId,
    accessToken: body.accessToken,
    lastReconciledAt: body.lastReconciledAt ?? null,
    cursor: body.cursor,
  };
}

// ── Engine-brokered per-space DB transport (pure; used by the task wrapper) ──

export interface CreateIncrementalDbTransportArgs {
  engineUrl: string;
  internalToken: string;
  spaceId: string;
  /** The pass's base — the IncrementalDb methods don't carry it, but the
   *  engine's op bodies scope schema/version/table reads+writes per base. */
  baseId: string;
  fetchImpl?: typeof fetch;
}

/**
 * Real HTTP transport for the IncrementalDb seam: every method maps to one
 * `op` on POST /api/internal/spaces/:spaceId/incremental-apply (the
 * engine-brokered per-space write route, server-dynamic-mode Phase 3 —
 * op mapping documented in that route's header; wire shapes mirrored in
 * apps/server/src/lib/per-space/incremental-apply.ts). Non-2xx throws with
 * op + status so failures surface loudly in the run.
 */
export function createIncrementalDbTransport(
  args: CreateIncrementalDbTransportArgs,
): IncrementalDb {
  const fetchFn = args.fetchImpl ?? fetch;
  const url = `${trimSlash(args.engineUrl)}/api/internal/spaces/${encodeURIComponent(args.spaceId)}/incremental-apply`;
  const headers = {
    "x-internal-token": args.internalToken,
    "content-type": "application/json",
  };

  async function post<T>(body: Record<string, unknown>): Promise<T> {
    const res = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`incremental-apply op ${String(body.op)} returned ${res.status}`);
    }
    return (await res.json()) as T;
  }

  return {
    async openBaseRun({ backupRunId, baseId }) {
      const out = await post<{ baseRunId: string }>({
        op: "open-base-run",
        backupRunId,
        baseId,
      });
      return { baseRunId: out.baseRunId };
    },
    async completeBaseRun({ baseRunId, status, counts, errorMessage }) {
      await post({
        op: "complete-base-run",
        baseRunId,
        status,
        counts,
        ...(errorMessage !== undefined ? { errorMessage } : {}),
      });
    },
    async applySchemaEvents(baseRunId, writes) {
      await post({ op: "apply-schema-events", baseRunId, baseId: args.baseId, writes });
    },
    async applyRecordEvents(baseRunId, writes) {
      await post({ op: "apply-record-events", baseRunId, baseId: args.baseId, writes });
    },
    async getStoredRecords(tableId, recordIds) {
      const out = await post<{ records: Record<string, StoredRecordState | undefined> }>({
        op: "get-stored-records",
        tableId,
        recordIds,
      });
      return out.records;
    },
    async insertSchemaVersion({ baseRunId, schemaHash, schemaJson }) {
      const out = await post<{ inserted: boolean }>({
        op: "insert-schema-version",
        baseRunId,
        baseId: args.baseId,
        schemaHash,
        schemaJson,
      });
      return { inserted: out.inserted };
    },
    async getAppliedSchemaState() {
      const out = await post<{ state: AppliedSchemaState }>({
        op: "get-applied-schema-state",
        baseId: args.baseId,
      });
      return out.state;
    },
    async regenerateViews(tableIds) {
      // Honest no-op server-side today (views_not_generated) — the op still
      // rides so the gap stays observable in the engine's response.
      await post({ op: "regenerate-views", tableIds });
    },
    async listStoredRecordIds(tableId) {
      const out = await post<{ recordIds: string[] }>({
        op: "list-stored-record-ids",
        tableId,
      });
      return out.recordIds;
    },
    async listTableIds() {
      const out = await post<{ tableIds: string[] }>({
        op: "list-table-ids",
        baseId: args.baseId,
      });
      return out.tableIds;
    },
  };
}
