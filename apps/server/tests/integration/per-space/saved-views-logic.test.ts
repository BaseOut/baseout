// Pure validation for the saved-views broker (server-saved-views D3):
// create-shape checks, patch-shape checks, and the table_locked invariant —
// a tableId key in a patch is rejected even if unchanged.
import { describe, it, expect } from "vitest";
import { parseCreateSavedView, parsePatchSavedView } from "../../../src/lib/per-space/saved-views-logic";

const config = { tableId: "tbl1", hiddenCols: [], filterTree: { kind: "group", conjunction: "and", children: [] } };

describe("parseCreateSavedView", () => {
  it("accepts a full create and trims the name", () => {
    const r = parseCreateSavedView({ name: "  My preset ", tableId: "tbl1", config, pinned: true, sortOrder: 3, createdByUserId: "u1" });
    expect(r).toEqual({ name: "My preset", tableId: "tbl1", config, pinned: true, sortOrder: 3, createdByUserId: "u1" });
  });
  it("accepts the minimal create (name + tableId + config)", () => {
    expect(parseCreateSavedView({ name: "n", tableId: "t", config })).toEqual({ name: "n", tableId: "t", config });
  });
  it("rejects missing/empty name, tableId, or non-object config", () => {
    expect(parseCreateSavedView({ tableId: "t", config })).toBeNull();
    expect(parseCreateSavedView({ name: " ", tableId: "t", config })).toBeNull();
    expect(parseCreateSavedView({ name: "n", config })).toBeNull();
    expect(parseCreateSavedView({ name: "n", tableId: "t", config: [] })).toBeNull();
    expect(parseCreateSavedView({ name: "n", tableId: "t", config: "x" })).toBeNull();
    expect(parseCreateSavedView({ name: "n", tableId: "t" })).toBeNull();
    expect(parseCreateSavedView(null)).toBeNull();
  });
  it("rejects malformed optionals", () => {
    expect(parseCreateSavedView({ name: "n", tableId: "t", config, pinned: "yes" })).toBeNull();
    expect(parseCreateSavedView({ name: "n", tableId: "t", config, sortOrder: 1.5 })).toBeNull();
  });
});

describe("parsePatchSavedView", () => {
  it("accepts partial patches", () => {
    expect(parsePatchSavedView({ name: "renamed" })).toEqual({ ok: true, patch: { name: "renamed" } });
    expect(parsePatchSavedView({ config, pinned: false, sortOrder: 0 })).toEqual({ ok: true, patch: { config, pinned: false, sortOrder: 0 } });
  });
  it("rejects a tableId key with table_locked — even snake_case, even unchanged", () => {
    expect(parsePatchSavedView({ tableId: "tbl1" })).toEqual({ ok: false, code: "table_locked" });
    expect(parsePatchSavedView({ name: "x", tableId: "tbl1" })).toEqual({ ok: false, code: "table_locked" });
    expect(parsePatchSavedView({ table_id: "tbl1" })).toEqual({ ok: false, code: "table_locked" });
  });
  it("rejects empty patches and malformed fields", () => {
    expect(parsePatchSavedView({})).toEqual({ ok: false, code: "invalid_request" });
    expect(parsePatchSavedView(null)).toEqual({ ok: false, code: "invalid_request" });
    expect(parsePatchSavedView({ name: "" })).toEqual({ ok: false, code: "invalid_request" });
    expect(parsePatchSavedView({ config: [] })).toEqual({ ok: false, code: "invalid_request" });
    expect(parsePatchSavedView({ pinned: 1 })).toEqual({ ok: false, code: "invalid_request" });
  });
});
