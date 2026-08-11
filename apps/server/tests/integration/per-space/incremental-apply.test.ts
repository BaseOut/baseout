// Pure-module tests for the incremental-apply seam (server-dynamic-mode,
// re-scoped 2026-07-23): wire-shape parsing + write planning for the
// engine-brokered IncrementalDb contract that
// apps/workflows/trigger/tasks/incremental-backup.ts injects. The drizzle
// appliers live in incremental-io.ts and are exercised by the smoke
// (describe-schema-io precedent); every DECISION is pinned here.

import { describe, expect, it } from "vitest";
import {
  buildAppliedSchemaState,
  decodeStoredCells,
  parseIncrementalApplyBody,
  planRecordWrites,
  planSchemaWrites,
  type RecordWrite,
  type SchemaWrite,
} from "../../../src/lib/per-space/incremental-apply";

const RUN = "22222222-2222-2222-2222-222222222222";
const ATTR = { actionSource: "client", actor: "usr123" };

// ── parseIncrementalApplyBody ────────────────────────────────────────────────

describe("parseIncrementalApplyBody", () => {
  it("rejects non-objects and unknown ops", () => {
    expect(parseIncrementalApplyBody(null).ok).toBe(false);
    expect(parseIncrementalApplyBody("x").ok).toBe(false);
    expect(parseIncrementalApplyBody({}).ok).toBe(false);
    expect(parseIncrementalApplyBody({ op: "explode" }).ok).toBe(false);
  });

  it("parses open-base-run and rejects a bad backupRunId", () => {
    const ok = parseIncrementalApplyBody({ op: "open-base-run", backupRunId: RUN, baseId: "appX" });
    expect(ok).toEqual({ ok: true, req: { op: "open-base-run", backupRunId: RUN, baseId: "appX" } });
    expect(parseIncrementalApplyBody({ op: "open-base-run", backupRunId: "nope", baseId: "appX" }).ok).toBe(false);
    expect(parseIncrementalApplyBody({ op: "open-base-run", backupRunId: RUN }).ok).toBe(false);
  });

  it("parses complete-base-run with counts and optional errorMessage", () => {
    const req = {
      op: "complete-base-run",
      baseRunId: RUN,
      status: "failed",
      counts: { created: 1, updated: 2, deleted: 3, reconciledRecords: 4 },
      errorMessage: "boom",
    };
    const parsed = parseIncrementalApplyBody(req);
    expect(parsed.ok).toBe(true);
    if (parsed.ok && parsed.req.op === "complete-base-run") {
      expect(parsed.req.counts.reconciledRecords).toBe(4);
      expect(parsed.req.errorMessage).toBe("boom");
    }
    expect(parseIncrementalApplyBody({ ...req, status: "meh" }).ok).toBe(false);
    expect(parseIncrementalApplyBody({ ...req, counts: { created: 1 } }).ok).toBe(false);
  });

  it("parses apply-schema-events and rejects unknown write kinds", () => {
    const good = parseIncrementalApplyBody({
      op: "apply-schema-events",
      baseRunId: RUN,
      baseId: "appX",
      writes: [{ kind: "destroyTable", tableId: "tblA", status: "removed", cascade: true }],
    });
    expect(good.ok).toBe(true);
    const bad = parseIncrementalApplyBody({
      op: "apply-schema-events",
      baseRunId: RUN,
      baseId: "appX",
      writes: [{ kind: "reticulate", tableId: "tblA" }],
    });
    expect(bad.ok).toBe(false);
    const noTable = parseIncrementalApplyBody({
      op: "apply-schema-events",
      baseRunId: RUN,
      baseId: "appX",
      writes: [{ kind: "destroyTable", status: "removed", cascade: true }],
    });
    expect(noTable.ok).toBe(false);
  });

  it("parses apply-record-events and rejects a write without ids", () => {
    const good = parseIncrementalApplyBody({
      op: "apply-record-events",
      baseRunId: RUN,
      baseId: "appX",
      writes: [{ kind: "destroyRecord", tableId: "tblA", recordId: "recA", status: "deleted" }],
    });
    expect(good.ok).toBe(true);
    const bad = parseIncrementalApplyBody({
      op: "apply-record-events",
      baseRunId: RUN,
      baseId: "appX",
      writes: [{ kind: "updateCell", tableId: "tblA", value: 1, modifiedTime: null, log: null }],
    });
    expect(bad.ok).toBe(false);
  });

  it("parses the read-seam + utility ops", () => {
    expect(parseIncrementalApplyBody({ op: "get-stored-records", tableId: "tblA", recordIds: ["recA"] }).ok).toBe(true);
    expect(parseIncrementalApplyBody({ op: "get-stored-records", tableId: "tblA", recordIds: [1] }).ok).toBe(false);
    expect(parseIncrementalApplyBody({ op: "get-applied-schema-state", baseId: "appX" }).ok).toBe(true);
    expect(parseIncrementalApplyBody({ op: "list-stored-record-ids", tableId: "tblA" }).ok).toBe(true);
    expect(parseIncrementalApplyBody({ op: "list-table-ids", baseId: "appX" }).ok).toBe(true);
    expect(parseIncrementalApplyBody({ op: "regenerate-views", tableIds: ["tblA"] }).ok).toBe(true);
    expect(
      parseIncrementalApplyBody({
        op: "insert-schema-version",
        baseRunId: RUN,
        baseId: "appX",
        schemaHash: "abc",
        schemaJson: { tables: [] },
      }).ok,
    ).toBe(true);
    expect(
      parseIncrementalApplyBody({ op: "insert-schema-version", baseRunId: RUN, baseId: "appX", schemaHash: "" }).ok,
    ).toBe(false);
  });
});

// ── planSchemaWrites ─────────────────────────────────────────────────────────

describe("planSchemaWrites", () => {
  it("expands createTable into a table upsert plus one field upsert per field", () => {
    const writes: SchemaWrite[] = [
      {
        kind: "createTable",
        tableId: "tblA",
        name: "Deals",
        description: "d",
        fields: [
          { fieldId: "fld1", name: "Amount", type: "currency", description: null },
          { fieldId: "fld2", name: null, type: null, description: null },
        ],
      },
    ];
    const plan = planSchemaWrites(writes);
    expect(plan.ops).toEqual([
      { op: "upsertTable", tableId: "tblA", name: "Deals", description: "d" },
      { op: "upsertField", fieldId: "fld1", tableId: "tblA", name: "Amount", type: "currency", description: null },
      // null name/type coalesce (bo_at columns are NOT NULL) — documented fallback
      { op: "upsertField", fieldId: "fld2", tableId: "tblA", name: "", type: "unknown", description: null },
    ]);
    expect(plan.skippedViews).toBe(0);
  });

  it("plans destroys as confident removals with table cascade", () => {
    const plan = planSchemaWrites([
      { kind: "destroyTable", tableId: "tblA", status: "removed", cascade: true },
      { kind: "destroyField", tableId: "tblB", fieldId: "fld9", status: "removed", cascade: true },
    ]);
    expect(plan.ops).toEqual([
      { op: "removeTableCascade", tableId: "tblA" },
      { op: "removeField", fieldId: "fld9", tableId: "tblB" },
    ]);
  });

  it("patches only the keys present on updateField and logs with attribution", () => {
    const writes: SchemaWrite[] = [
      {
        kind: "updateField",
        tableId: "tblA",
        fieldId: "fld1",
        set: { description: "new" },
        log: { changeType: "description", beforeValue: "old", afterValue: "new", breaksData: false, ...ATTR },
      },
    ];
    const plan = planSchemaWrites(writes);
    expect(plan.ops).toEqual([
      { op: "patchField", fieldId: "fld1", tableId: "tblA", set: { description: "new" } },
      {
        op: "logSchemaUpdate",
        row: {
          entityType: "field",
          entityId: "fld1",
          tableId: "tblA",
          changeType: "description",
          beforeValue: "old",
          afterValue: "new",
          breaksData: false,
          actionSource: "client",
          actor: "usr123",
        },
      },
    ]);
  });

  it("emits only the log when an updateField set is empty; retypes carry breaksData", () => {
    const plan = planSchemaWrites([
      {
        kind: "updateField",
        tableId: "tblA",
        fieldId: "fld1",
        set: {},
        log: { changeType: "type", beforeValue: { type: "text" }, afterValue: { type: "number" }, breaksData: true, ...ATTR },
      },
    ]);
    expect(plan.ops).toHaveLength(1);
    expect(plan.ops[0]).toMatchObject({ op: "logSchemaUpdate", row: { changeType: "type", breaksData: true } });
  });

  it("plans updateTableMetadata as a table patch plus one log per entry (tableId = the table)", () => {
    const plan = planSchemaWrites([
      {
        kind: "updateTableMetadata",
        tableId: "tblA",
        set: { name: "Deals v2", description: null },
        logs: [
          { changeType: "name", beforeValue: "Deals", afterValue: "Deals v2", breaksData: false, ...ATTR },
          { changeType: "description", beforeValue: "d", afterValue: null, breaksData: false, ...ATTR },
        ],
      },
    ]);
    expect(plan.ops[0]).toEqual({ op: "patchTable", tableId: "tblA", set: { name: "Deals v2", description: null } });
    expect(plan.ops.slice(1)).toEqual([
      expect.objectContaining({ op: "logSchemaUpdate", row: expect.objectContaining({ entityType: "table", entityId: "tblA", tableId: "tblA", changeType: "name" }) }),
      expect.objectContaining({ op: "logSchemaUpdate", row: expect.objectContaining({ entityType: "table", changeType: "description", afterValue: null }) }),
    ]);
  });

  it("skips updateView (Enterprise capture gate not enforced) and counts it", () => {
    const plan = planSchemaWrites([
      { kind: "updateView", tableId: "tblA", viewId: "viw1", change: { x: 1 } },
      { kind: "createField", tableId: "tblA", fieldId: "fld1", name: "A", type: "text", description: null },
    ]);
    expect(plan.skippedViews).toBe(1);
    expect(plan.ops).toEqual([
      { op: "upsertField", fieldId: "fld1", tableId: "tblA", name: "A", type: "text", description: null },
    ]);
  });

  it("preserves write order across kinds", () => {
    const plan = planSchemaWrites([
      { kind: "createField", tableId: "tblA", fieldId: "fld1", name: "A", type: "text", description: null },
      { kind: "destroyField", tableId: "tblA", fieldId: "fld0", status: "removed", cascade: true },
      { kind: "createField", tableId: "tblA", fieldId: "fld2", name: "B", type: "text", description: null },
    ]);
    expect(plan.ops.map((o) => o.op)).toEqual(["upsertField", "removeField", "upsertField"]);
  });
});

// ── planRecordWrites ─────────────────────────────────────────────────────────

describe("planRecordWrites", () => {
  it("encodes createRecord cells sparsely (empty values dropped) with no logs", () => {
    const writes: RecordWrite[] = [
      {
        kind: "createRecord",
        tableId: "tblA",
        recordId: "recA",
        createdTime: "2026-07-23T00:00:00.000Z",
        cells: { fld1: "hello", fld2: null, fld3: "", fld4: { a: 1 } },
      },
    ];
    const plan = planRecordWrites(writes);
    expect(plan.ops).toEqual([
      {
        op: "upsertRecord",
        recordId: "recA",
        tableId: "tblA",
        createdTime: "2026-07-23T00:00:00.000Z",
        cells: { fld1: '"hello"', fld4: '{"a":1}' },
      },
    ]);
  });

  it("plans updateCell as an encoded cell upsert plus a superseded-value log with attribution", () => {
    const writes: RecordWrite[] = [
      {
        kind: "updateCell",
        tableId: "tblA",
        recordId: "recA",
        fieldId: "fld1",
        value: 42,
        modifiedTime: "2026-07-23T01:00:00.000Z",
        log: { oldValue: "hello", ...ATTR },
      },
    ];
    expect(planRecordWrites(writes).ops).toEqual([
      { op: "upsertCell", recordId: "recA", tableId: "tblA", fieldId: "fld1", value: "42", modifiedTime: "2026-07-23T01:00:00.000Z" },
      { op: "logRecordUpdate", recordId: "recA", tableId: "tblA", fieldId: "fld1", oldValue: '"hello"', actionSource: "client", actor: "usr123" },
    ]);
  });

  it("first-population updateCell (log null) writes the cell without a log", () => {
    const plan = planRecordWrites([
      { kind: "updateCell", tableId: "tblA", recordId: "recA", fieldId: "fld1", value: "x", modifiedTime: null, log: null },
    ]);
    expect(plan.ops).toEqual([
      { op: "upsertCell", recordId: "recA", tableId: "tblA", fieldId: "fld1", value: '"x"', modifiedTime: null },
    ]);
  });

  it("a cleared cell carries value null and still logs the old value", () => {
    const plan = planRecordWrites([
      { kind: "updateCell", tableId: "tblA", recordId: "recA", fieldId: "fld1", value: null, modifiedTime: null, log: { oldValue: 7, actionSource: null, actor: null } },
    ]);
    expect(plan.ops).toEqual([
      { op: "upsertCell", recordId: "recA", tableId: "tblA", fieldId: "fld1", value: null, modifiedTime: null },
      { op: "logRecordUpdate", recordId: "recA", tableId: "tblA", fieldId: "fld1", oldValue: "7", actionSource: null, actor: null },
    ]);
  });

  it("plans destroyRecord as status=deleted and preserves order", () => {
    const plan = planRecordWrites([
      { kind: "destroyRecord", tableId: "tblA", recordId: "recA", status: "deleted" },
      { kind: "createRecord", tableId: "tblA", recordId: "recB", createdTime: null, cells: {} },
    ]);
    expect(plan.ops).toEqual([
      { op: "deleteRecord", recordId: "recA", tableId: "tblA" },
      { op: "upsertRecord", recordId: "recB", tableId: "tblA", createdTime: null, cells: {} },
    ]);
  });
});

// ── decodeStoredCells / buildAppliedSchemaState ──────────────────────────────

describe("decodeStoredCells", () => {
  it("decodes JSON values, keeps cleared cells present-with-null, and returns empty cells for cell-less records", () => {
    const out = decodeStoredCells(
      [{ recordId: "recA" }, { recordId: "recB" }],
      [
        { recordId: "recA", fieldId: "fld1", value: '"hello"' },
        { recordId: "recA", fieldId: "fld2", value: null },
      ],
    );
    expect(out).toEqual({
      recA: { cells: { fld1: "hello", fld2: null } },
      recB: { cells: {} },
    });
    expect(Object.prototype.hasOwnProperty.call(out, "recC")).toBe(false);
  });

  it("survives an unparsable stored value by passing it through raw", () => {
    const out = decodeStoredCells([{ recordId: "recA" }], [{ recordId: "recA", fieldId: "fld1", value: "not-json" }]);
    expect(out.recA!.cells.fld1).toBe("not-json");
  });
});

describe("buildAppliedSchemaState", () => {
  it("nests active fields under their tables and drops orphan fields", () => {
    const state = buildAppliedSchemaState(
      [{ tableId: "tblA" }, { tableId: "tblB" }],
      [
        { fieldId: "fld1", tableId: "tblA", type: "text" },
        { fieldId: "fld2", tableId: "tblGone", type: "number" },
      ],
    );
    expect(state).toEqual({
      tables: {
        tblA: { fields: { fld1: { type: "text" } } },
        tblB: { fields: {} },
      },
    });
  });
});
