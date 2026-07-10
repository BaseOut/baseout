// Pure-logic tests for deriveRelationships (server-relationships). No DB/AI —
// API relationships are computed from the per-Space field rows. Placed under
// tests/integration/** so the server test runner picks it up (it only includes
// that glob), though it touches no bindings.

import { describe, expect, it } from "vitest";
import {
  deriveRelationships,
  RELATIONSHIP_TYPES,
  type RelFieldRow,
  type RelTableRow,
} from "../../../src/lib/per-space/relationships";

const tables: RelTableRow[] = [
  { tableId: "tblA", baseId: "appX", name: "Projects", status: "active" },
  { tableId: "tblB", baseId: "appX", name: "Tasks", status: "active" },
  { tableId: "tblGone", baseId: "appX", name: "Archive", status: "removed" },
];

function field(over: Partial<RelFieldRow>): RelFieldRow {
  return {
    fieldId: "fld1",
    tableId: "tblA",
    baseId: "appX",
    name: "Field",
    type: "singleLineText",
    options: null,
    status: "active",
    ...over,
  };
}

describe("deriveRelationships", () => {
  it("ignores non-relationship field types", () => {
    const rels = deriveRelationships({
      tables,
      fields: [field({ type: "singleLineText" }), field({ fieldId: "f2", type: "number" })],
    });
    expect(rels).toEqual([]);
  });

  it("maps a multipleRecordLinks field to a linkedRecords relationship", () => {
    const rels = deriveRelationships({
      tables,
      fields: [
        field({
          fieldId: "fldLink",
          tableId: "tblA",
          name: "Tasks",
          type: "multipleRecordLinks",
          options: { linkedTableId: "tblB" },
        }),
      ],
    });
    expect(rels).toHaveLength(1);
    expect(rels[0]).toMatchObject({
      id: "linkedRecords:fldLink",
      type: "linkedRecords",
      anchorFieldId: "fldLink",
      anchorTableId: "tblA",
      inferred: false,
      valid: true,
      hasRemovedHistory: false,
    });
    expect(rels[0]!.refs[0]).toMatchObject({ tableId: "tblB", name: "Tasks", removed: false });
    expect(rels[0]!.label).toBe("Projects ↔ Tasks");
  });

  it("flags a link to a removed table as removed history + invalid", () => {
    const rels = deriveRelationships({
      tables,
      fields: [
        field({
          fieldId: "fldDead",
          type: "multipleRecordLinks",
          options: { linkedTableId: "tblGone" },
        }),
      ],
    });
    expect(rels[0]!.refs[0]).toMatchObject({ tableId: "tblGone", removed: true });
    expect(rels[0]!.hasRemovedHistory).toBe(true);
    // Anchor active but the only ref is removed ⇒ invalid.
    expect(rels[0]!.valid).toBe(false);
  });

  it("treats a link to an unknown table id as removed (no row)", () => {
    const rels = deriveRelationships({
      tables,
      fields: [field({ fieldId: "fX", type: "multipleRecordLinks", options: { linkedTableId: "tblNope" } })],
    });
    expect(rels[0]!.refs[0]).toMatchObject({ tableId: "tblNope", removed: true, name: "tblNope" });
    expect(rels[0]!.valid).toBe(false);
  });

  it("expands rollup/lookup refs via recordLinkFieldId + fieldIdInLinkedTable", () => {
    const fields: RelFieldRow[] = [
      field({ fieldId: "fldLink", name: "Tasks", type: "multipleRecordLinks", options: { linkedTableId: "tblB" } }),
      field({ fieldId: "fldSrc", tableId: "tblB", name: "Hours", type: "number" }),
      field({
        fieldId: "fldRoll",
        name: "Total Hours",
        type: "rollup",
        options: { recordLinkFieldId: "fldLink", fieldIdInLinkedTable: "fldSrc" },
      }),
    ];
    const rels = deriveRelationships({ tables, fields });
    const roll = rels.find((r) => r.type === "rollups");
    expect(roll).toBeTruthy();
    expect(roll!.refs.map((r) => r.fieldId)).toEqual(["fldLink", "fldSrc"]);
    expect(roll!.valid).toBe(true);
  });

  it("expands formula referencedFieldIds into refs", () => {
    const withRefs = deriveRelationships({
      tables,
      fields: [
        field({ fieldId: "fA", name: "A", type: "number" }),
        field({ fieldId: "fForm", name: "Calc", type: "formula", options: { referencedFieldIds: ["fA"] } }),
      ],
    });
    const form = withRefs.find((r) => r.type === "formulas")!;
    expect(form.refs.map((r) => r.fieldId)).toEqual(["fA"]);
  });

  it("emits NO row for a formula that references no fields (2026-07-09 product call)", () => {
    // A formula like `"https://…" & ENCODE_URL_COMPONENT(RECORD_ID())` references
    // zero fields — Airtable exposes referencedFieldIds: []. A "relationship"
    // with only its anchor endpoint is noise, not a relationship.
    const noRefs = deriveRelationships({
      tables,
      fields: [field({ fieldId: "fForm2", name: "Calc", type: "formula", options: {} })],
    });
    expect(noRefs).toEqual([]);
    const emptyRefs = deriveRelationships({
      tables,
      fields: [field({ fieldId: "fLm", type: "lastModifiedTime", options: { referencedFieldIds: [] } })],
    });
    expect(emptyRefs).toEqual([]);
  });

  it("maps lastModifiedTime to a lastModified relationship", () => {
    const rels = deriveRelationships({
      tables,
      fields: [
        field({ fieldId: "fA", name: "A", type: "number" }),
        field({ fieldId: "fLm", type: "lastModifiedTime", options: { referencedFieldIds: ["fA"] } }),
      ],
    });
    expect(rels.find((r) => r.type === "lastModified")).toBeTruthy();
  });

  it("a removed anchor field is invalid + flagged", () => {
    const rels = deriveRelationships({
      tables,
      fields: [
        field({
          fieldId: "fldLink",
          type: "multipleRecordLinks",
          options: { linkedTableId: "tblB" },
          status: "removed",
        }),
      ],
    });
    expect(rels[0]!.valid).toBe(false);
    expect(rels[0]!.hasRemovedHistory).toBe(true);
  });

  it("exposes the canonical relationship type list", () => {
    expect(RELATIONSHIP_TYPES).toEqual([
      "linkedRecords",
      "formulas",
      "rollups",
      "lookups",
      "lastModified",
    ]);
  });
});
