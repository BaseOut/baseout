import { describe, it, expect } from "vitest";
import { extractFieldConfig, type FieldConfig } from "../../../src/lib/per-space/schema-enrich";

const NULLS: FieldConfig = {
  linkedTableId: null,
  allowsMultiple: null,
  inverseFieldId: null,
  formula: null,
  referencedFieldIds: null,
  lookupViaFieldId: null,
  lookupTargetFieldId: null,
  choices: null,
};

describe("extractFieldConfig", () => {
  it("maps a multipleRecordLinks field (multi-link, with inverse)", () => {
    expect(
      extractFieldConfig("multipleRecordLinks", {
        linkedTableId: "tblB",
        inverseLinkFieldId: "fldInv",
        prefersSingleRecordLink: false,
      }),
    ).toEqual({ ...NULLS, linkedTableId: "tblB", allowsMultiple: true, inverseFieldId: "fldInv" });
  });

  it("maps a single-link (prefersSingleRecordLink) without inverse", () => {
    expect(
      extractFieldConfig("multipleRecordLinks", {
        linkedTableId: "tblB",
        prefersSingleRecordLink: true,
      }),
    ).toEqual({ ...NULLS, linkedTableId: "tblB", allowsMultiple: false });
  });

  it("maps select choices to their names", () => {
    const options = {
      choices: [
        { id: "sel1", name: "Open", color: "blueLight2" },
        { id: "sel2", name: "Won" },
        { id: "sel3" }, // nameless choice is skipped
      ],
    };
    expect(extractFieldConfig("singleSelect", options)).toEqual({ ...NULLS, choices: ["Open", "Won"] });
    expect(extractFieldConfig("multipleSelects", options)).toEqual({ ...NULLS, choices: ["Open", "Won"] });
  });

  it("maps a formula field", () => {
    expect(
      extractFieldConfig("formula", {
        formula: "{fldA} * {fldB}",
        referencedFieldIds: ["fldA", "fldB", 42],
        result: { type: "number" },
      }),
    ).toEqual({ ...NULLS, formula: "{fldA} * {fldB}", referencedFieldIds: ["fldA", "fldB"] });
  });

  it("maps rollup and lookup anchoring", () => {
    const options = { recordLinkFieldId: "fldLink", fieldIdInLinkedTable: "fldTarget" };
    for (const type of ["rollup", "multipleLookupValues"]) {
      expect(extractFieldConfig(type, options)).toEqual({
        ...NULLS,
        lookupViaFieldId: "fldLink",
        lookupTargetFieldId: "fldTarget",
      });
    }
  });

  it("maps a count field's via-link only", () => {
    expect(extractFieldConfig("count", { recordLinkFieldId: "fldLink" })).toEqual({
      ...NULLS,
      lookupViaFieldId: "fldLink",
    });
  });

  it("returns all nulls for plain types and degrades on bad options", () => {
    expect(extractFieldConfig("singleLineText", { someKey: 1 })).toEqual(NULLS);
    expect(extractFieldConfig("multipleRecordLinks", null)).toEqual(NULLS);
    expect(extractFieldConfig("formula", "not-an-object")).toEqual(NULLS);
    expect(extractFieldConfig("singleSelect", { choices: "nope" })).toEqual(NULLS);
  });
});
