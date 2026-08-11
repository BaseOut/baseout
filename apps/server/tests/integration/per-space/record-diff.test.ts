import { describe, it, expect } from "vitest";
import {
  diffRecords,
  encodeCellValue,
  type PriorCell,
  type PriorRecord,
} from "../../../src/lib/per-space/record-diff";

const RUN = "run-1";
const T = "tblA";

const cell = (r: string, f: string, v: string | null): PriorCell => ({ recordId: r, fieldId: f, value: v });
const rec = (r: string, status = "active"): PriorRecord => ({ recordId: r, status });

describe("encodeCellValue", () => {
  it("empties → null; everything else JSON-encoded", () => {
    expect(encodeCellValue(null)).toBeNull();
    expect(encodeCellValue(undefined)).toBeNull();
    expect(encodeCellValue("")).toBeNull();
    expect(encodeCellValue("hi")).toBe('"hi"');
    expect(encodeCellValue(42)).toBe("42");
    expect(encodeCellValue(["a", "b"])).toBe('["a","b"]');
  });
});

describe("diffRecords — first capture", () => {
  const r = diffRecords({
    tableId: T,
    captured: [{ recordId: "rec1", createdTime: "2026-01-01T00:00:00Z", cells: { fld1: "Acme", fld2: 100 } }],
    priorRecords: [],
    priorCells: [],
    runId: RUN,
    confident: true,
  });
  it("inserts the record + cells; first population logs NOTHING", () => {
    expect(r.records).toEqual([
      { recordId: "rec1", action: "insert", createdTime: "2026-01-01T00:00:00Z", modifiedTime: null },
    ]);
    expect(r.cells.map((c) => [c.fieldId, c.action, c.value])).toEqual([
      ["fld1", "insert", '"Acme"'],
      ["fld2", "insert", "100"],
    ]);
    expect(r.recordUpdates).toHaveLength(0);
  });
});

describe("diffRecords — value change", () => {
  const r = diffRecords({
    tableId: T,
    captured: [{ recordId: "rec1", cells: { fld1: "Acme", fld2: 200 } }],
    priorRecords: [rec("rec1")],
    priorCells: [cell("rec1", "fld1", '"Acme"'), cell("rec1", "fld2", "100")],
    runId: RUN,
    confident: true,
  });
  it("updates the changed cell + logs the OLD value; unchanged cell is seen", () => {
    expect(r.cells.find((c) => c.fieldId === "fld1")?.action).toBe("seen");
    expect(r.cells.find((c) => c.fieldId === "fld2")).toMatchObject({ action: "update", value: "200" });
    expect(r.recordUpdates).toEqual([{ recordId: "rec1", fieldId: "fld2", oldValue: "100" }]);
  });
});

describe("diffRecords — cleared cell", () => {
  const r = diffRecords({
    tableId: T,
    captured: [{ recordId: "rec1", cells: { fld1: "Acme" } }], // fld2 now absent ⇒ cleared
    priorRecords: [rec("rec1")],
    priorCells: [cell("rec1", "fld1", '"Acme"'), cell("rec1", "fld2", "100")],
    runId: RUN,
    confident: true,
  });
  it("sets the cleared cell to null + logs old value; row persists", () => {
    const fld2 = r.cells.find((c) => c.fieldId === "fld2");
    expect(fld2).toMatchObject({ action: "update", value: null });
    expect(r.recordUpdates).toEqual([{ recordId: "rec1", fieldId: "fld2", oldValue: "100" }]);
  });
});

describe("diffRecords — repopulating a cleared cell logs the null it replaced", () => {
  const r = diffRecords({
    tableId: T,
    captured: [{ recordId: "rec1", cells: { fld2: 50 } }],
    priorRecords: [rec("rec1")],
    priorCells: [cell("rec1", "fld2", null)], // row exists, previously cleared
    runId: RUN,
    confident: true,
  });
  it("is an update (not insert) and logs oldValue=null", () => {
    expect(r.cells.find((c) => c.fieldId === "fld2")).toMatchObject({ action: "update", value: "50" });
    expect(r.recordUpdates).toEqual([{ recordId: "rec1", fieldId: "fld2", oldValue: null }]);
  });
});

describe("diffRecords — deletions", () => {
  it("absent record on a CONFIDENT capture → deleted", () => {
    const r = diffRecords({
      tableId: T,
      captured: [{ recordId: "rec1", cells: { fld1: "A" } }],
      priorRecords: [rec("rec1"), rec("rec2")],
      priorCells: [],
      runId: RUN,
      confident: true,
    });
    expect(r.records.find((x) => x.recordId === "rec2")?.action).toBe("deleted");
  });

  it("absent record on a PARTIAL/trial capture → unknown", () => {
    const r = diffRecords({
      tableId: T,
      captured: [{ recordId: "rec1", cells: { fld1: "A" } }],
      priorRecords: [rec("rec1"), rec("rec2")],
      priorCells: [],
      runId: RUN,
      confident: false,
    });
    expect(r.records.find((x) => x.recordId === "rec2")?.action).toBe("unknown");
  });

  it("an already-deleted prior record that stays absent emits no op", () => {
    const r = diffRecords({
      tableId: T,
      captured: [],
      priorRecords: [rec("rec2", "deleted")],
      priorCells: [],
      runId: RUN,
      confident: true,
    });
    expect(r.records).toHaveLength(0);
  });
});
