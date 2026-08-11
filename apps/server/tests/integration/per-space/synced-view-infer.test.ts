// Pure-logic tests for inferSyncedViews (server-relationships). The synced-view
// heuristic runs engine-side (data locality: the engine has the per-Space
// schema), triggered per-run via /relationships/sync. Placed under
// tests/integration/** so the server runner picks it up; touches no bindings.

import { describe, expect, it } from "vitest";
import {
  inferSyncedViews,
  type InferFieldRow,
  type InferTableRow,
} from "../../../src/lib/per-space/synced-view-infer";

const tables: InferTableRow[] = [
  { tableId: "tblSrc", baseId: "appX", name: "Customers" },
  { tableId: "tblSync", baseId: "appX", name: "Customers (synced)" },
  { tableId: "tblOther", baseId: "appX", name: "Invoices" },
  { tableId: "tblOtherBase", baseId: "appY", name: "Customers" },
];

const fields: InferFieldRow[] = [
  { tableId: "tblSrc", name: "Name", type: "singleLineText" },
  { tableId: "tblSrc", name: "Email", type: "email" },
  { tableId: "tblSrc", name: "Tier", type: "singleSelect" },

  { tableId: "tblSync", name: "Name", type: "singleLineText" },
  { tableId: "tblSync", name: "email", type: "email" }, // case-insensitive match
  { tableId: "tblSync", name: "Tier", type: "singleSelect" },

  { tableId: "tblOther", name: "Name", type: "singleLineText" },
  { tableId: "tblOther", name: "Amount", type: "currency" },

  { tableId: "tblOtherBase", name: "Name", type: "singleLineText" },
  { tableId: "tblOtherBase", name: "Email", type: "email" },
  { tableId: "tblOtherBase", name: "Tier", type: "singleSelect" },
];

describe("inferSyncedViews", () => {
  it("proposes a candidate for high field overlap, with matched pairs + score", () => {
    const out = inferSyncedViews({ tables, fields });
    const cand = out.find((c) => c.sourceTableId === "tblSrc" && c.destTableId === "tblSync");
    expect(cand).toBeTruthy();
    expect(cand!.matchScore).toBe(100);
    expect(cand!.matchedPairs).toHaveLength(3);
    expect(cand!.baseId).toBe("appX");
  });

  it("does not propose low-overlap pairs (Invoices shares 1 field)", () => {
    const out = inferSyncedViews({ tables, fields });
    expect(out.some((c) => c.sourceTableId === "tblOther" || c.destTableId === "tblOther")).toBe(false);
  });

  it("never crosses base boundaries", () => {
    const out = inferSyncedViews({ tables, fields });
    expect(out.every((c) => c.baseId === "appX")).toBe(true);
    expect(
      out.some((c) => c.sourceTableId === "tblOtherBase" || c.destTableId === "tblOtherBase"),
    ).toBe(false);
  });

  it("emits one candidate per unordered pair, canonical source<dest", () => {
    const out = inferSyncedViews({ tables, fields });
    const pair = out.filter(
      (c) =>
        (c.sourceTableId === "tblSrc" && c.destTableId === "tblSync") ||
        (c.sourceTableId === "tblSync" && c.destTableId === "tblSrc"),
    );
    expect(pair).toHaveLength(1);
    expect(pair[0]!.sourceTableId < pair[0]!.destTableId).toBe(true);
  });

  it("respects dismissals (order-insensitive) and never re-proposes them", () => {
    const out = inferSyncedViews({
      tables,
      fields,
      dismissed: [{ sourceTableId: "tblSync", destTableId: "tblSrc" }],
    });
    expect(out).toHaveLength(0);
  });

  it("honors a custom threshold", () => {
    expect(inferSyncedViews({ tables, fields, threshold: 101 })).toHaveLength(0);
  });

  it("honors minMatches (2 by default excludes single-field overlaps)", () => {
    const twoTables: InferTableRow[] = [
      { tableId: "t1", baseId: "b", name: "One" },
      { tableId: "t2", baseId: "b", name: "Two" },
    ];
    const oneShared: InferFieldRow[] = [
      { tableId: "t1", name: "Name", type: "singleLineText" },
      { tableId: "t1", name: "X", type: "number" },
      { tableId: "t2", name: "Name", type: "singleLineText" },
      { tableId: "t2", name: "Y", type: "number" },
    ];
    expect(inferSyncedViews({ tables: twoTables, fields: oneShared })).toHaveLength(0);
  });

  it("is deterministic (stable sort by base, source, dest)", () => {
    expect(inferSyncedViews({ tables, fields })).toEqual(inferSyncedViews({ tables, fields }));
  });
});
