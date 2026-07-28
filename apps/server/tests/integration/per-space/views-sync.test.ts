// Pure-module tests for the MCP views capture (server-mcp-views): wire-field
// parsing + run-over-run diff against the prior bo_at_views working set. The
// envelope is the per-table aggregation of `list_views_for_table` results the
// workflows task forwards (all-or-skip — a present capture covers every table
// of the base). Spike-pinned envelope (2026-07-27, workflows-mcp-views README):
// inventory-grade `{ views: [{ id, name, type }] }` — no configuration, so no
// definition column and no config changelog rows (design Decision 4,
// no-migration branch).

import { describe, it, expect } from "vitest";
import {
  diffViews,
  parseViewsField,
  type ExtractedView,
} from "../../../src/lib/per-space/views-sync";
import type { PriorView } from "../../../src/lib/per-space/schema-diff";

const tableEnvelope = (views: unknown[]) => ({ views });

const capture = (tables: { tableId: string; raw: unknown }[]) => ({
  capturedAt: "2026-07-27T10:00:00.000Z",
  tables,
});

const prior = (over: Partial<PriorView> & { viewId: string }): PriorView => ({
  tableId: "tblA",
  name: "Grid view",
  type: "grid",
  status: "active",
  ...over,
});

describe("parseViewsField", () => {
  it("absent field means no view processing at all", () => {
    expect(parseViewsField(undefined)).toEqual({ kind: "absent" });
  });

  it("malformed capture (null / bad capturedAt / tables not an array) is invalid_capture", () => {
    expect(parseViewsField(null)).toMatchObject({ kind: "invalid", reason: "invalid_capture" });
    expect(parseViewsField({ capturedAt: "nope", tables: [] })).toMatchObject({
      kind: "invalid",
      reason: "invalid_capture",
    });
    expect(parseViewsField({ capturedAt: "2026-07-27T10:00:00.000Z", tables: "x" })).toMatchObject({
      kind: "invalid",
      reason: "invalid_capture",
    });
  });

  it("a malformed table entry invalidates the WHOLE capture (all-or-skip: partial visibility must not false-remove)", () => {
    const bad = capture([
      { tableId: "tblA", raw: tableEnvelope([{ id: "viwA", name: "Grid view", type: "grid" }]) },
      { tableId: "tblB", raw: { nope: true } }, // no views[]
    ]);
    expect(parseViewsField(bad)).toMatchObject({ kind: "invalid", reason: "invalid_envelope" });
    const badTableId = capture([{ tableId: 7 as unknown as string, raw: tableEnvelope([]) }]);
    expect(parseViewsField(badTableId)).toMatchObject({ kind: "invalid", reason: "invalid_envelope" });
  });

  it("extracts views keyed by id with table refs; type tolerated absent; junk entries dropped + counted", () => {
    const parsed = parseViewsField(
      capture([
        {
          tableId: "tblA",
          raw: tableEnvelope([
            { id: "viwA", name: "Grid view", type: "grid" },
            { id: "viwB", name: "Untyped" }, // no type — tolerated
            { id: 42, name: "junk" }, // non-string id — dropped
            "junk", // not a record — dropped
          ]),
        },
        { tableId: "tblB", raw: tableEnvelope([]) }, // zero views is a valid sighting
      ]),
    );
    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.views).toEqual([
      { viewId: "viwA", tableId: "tblA", name: "Grid view", type: "grid" },
      { viewId: "viwB", tableId: "tblA", name: "Untyped", type: null },
    ]);
    expect(parsed.dropped).toBe(2);
    expect(parsed.capturedAt.toISOString()).toBe("2026-07-27T10:00:00.000Z");
  });

  it("unknown envelope keys pass through harmlessly (envelope tolerance)", () => {
    const parsed = parseViewsField(
      capture([
        {
          tableId: "tblA",
          raw: { views: [{ id: "viwA", name: "Grid view", type: "grid", extra: 1 }], offset: null },
        },
      ]),
    );
    expect(parsed.kind).toBe("ok");
  });
});

describe("diffViews", () => {
  const next = (over: Partial<ExtractedView> & { viewId: string }): ExtractedView => ({
    tableId: "tblA",
    name: "Grid view",
    type: "grid",
    ...over,
  });

  it("first capture fills: inserts only, no schema updates", () => {
    const d = diffViews({ baseId: "appX", prior: [], next: [next({ viewId: "viwA" })] });
    expect(d.unchanged).toBe(false);
    expect(d.lifecycle).toEqual([
      {
        entity: "view",
        id: "viwA",
        action: "insert",
        baseId: "appX",
        tableId: "tblA",
        attrs: { tableId: "tblA", name: "Grid view", type: "grid" },
      },
    ]);
    expect(d.schemaUpdates).toEqual([]);
  });

  it("identical capture short-circuits (unchanged, zero ops)", () => {
    const d = diffViews({
      baseId: "appX",
      prior: [prior({ viewId: "viwA" })],
      next: [next({ viewId: "viwA" })],
    });
    expect(d.unchanged).toBe(true);
    expect(d.lifecycle).toEqual([]);
    expect(d.schemaUpdates).toEqual([]);
  });

  it("absent view id on a successful capture is a confident removal (not unknown)", () => {
    const d = diffViews({ baseId: "appX", prior: [prior({ viewId: "viwA" })], next: [] });
    expect(d.lifecycle).toEqual([
      { entity: "view", id: "viwA", action: "removed", baseId: "appX", tableId: "tblA", attrs: {} },
    ]);
  });

  it("already-removed rows are not re-removed", () => {
    const d = diffViews({
      baseId: "appX",
      prior: [prior({ viewId: "viwA", status: "removed" })],
      next: [],
    });
    expect(d.unchanged).toBe(true);
    expect(d.lifecycle).toEqual([]);
  });

  it("an `unknown` row absent from a successful capture resolves to removed (a capture is a full sighting)", () => {
    const d = diffViews({
      baseId: "appX",
      prior: [prior({ viewId: "viwA", status: "unknown" }), prior({ viewId: "viwB", status: "active", name: "Keep" })],
      next: [next({ viewId: "viwB", name: "Keep" })],
    });
    expect(d.unchanged).toBe(false);
    expect(d.lifecycle).toContainEqual({
      entity: "view",
      id: "viwA",
      action: "removed",
      baseId: "appX",
      tableId: "tblA",
      attrs: {},
    });
  });

  it("rename emits a seen op + a name schema-update (REST parity)", () => {
    const d = diffViews({
      baseId: "appX",
      prior: [prior({ viewId: "viwA", name: "Old name" })],
      next: [next({ viewId: "viwA", name: "New name" })],
    });
    expect(d.lifecycle).toEqual([
      {
        entity: "view",
        id: "viwA",
        action: "seen",
        baseId: "appX",
        tableId: "tblA",
        attrs: { tableId: "tblA", name: "New name", type: "grid" },
      },
    ]);
    expect(d.schemaUpdates).toEqual([
      {
        entityType: "view",
        entityId: "viwA",
        baseId: "appX",
        tableId: "tblA",
        changeType: "name",
        changeTypeName: null,
        beforeValue: "Old name",
        afterValue: "New name",
        breaksData: false,
      },
    ]);
  });

  it("type change emits a type schema-update", () => {
    const d = diffViews({
      baseId: "appX",
      prior: [prior({ viewId: "viwA", type: "grid" })],
      next: [next({ viewId: "viwA", type: "kanban" })],
    });
    expect(d.schemaUpdates).toMatchObject([
      { entityType: "view", entityId: "viwA", changeType: "type", beforeValue: "grid", afterValue: "kanban" },
    ]);
  });

  it("a removed/unknown row reappearing in the capture resurrects via seen (no updates vs its stored attrs when identical)", () => {
    for (const status of ["removed", "unknown"]) {
      const d = diffViews({
        baseId: "appX",
        prior: [prior({ viewId: "viwA", status })],
        next: [next({ viewId: "viwA" })],
      });
      expect(d.unchanged).toBe(false); // status differs — must write
      expect(d.lifecycle).toEqual([
        {
          entity: "view",
          id: "viwA",
          action: "seen",
          baseId: "appX",
          tableId: "tblA",
          attrs: { tableId: "tblA", name: "Grid view", type: "grid" },
        },
      ]);
      expect(d.schemaUpdates).toEqual([]);
    }
  });

  it("multi-table captures diff independently per view id", () => {
    const d = diffViews({
      baseId: "appX",
      prior: [prior({ viewId: "viwA" }), prior({ viewId: "viwB", tableId: "tblB", name: "Board", type: "kanban" })],
      next: [next({ viewId: "viwA" })], // tblB's view gone
    });
    expect(d.lifecycle).toEqual([
      { entity: "view", id: "viwA", action: "seen", baseId: "appX", tableId: "tblA", attrs: { tableId: "tblA", name: "Grid view", type: "grid" } },
      { entity: "view", id: "viwB", action: "removed", baseId: "appX", tableId: "tblB", attrs: {} },
    ]);
  });
});
