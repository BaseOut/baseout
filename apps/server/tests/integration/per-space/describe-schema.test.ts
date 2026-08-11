import { describe, expect, it } from "vitest";
import {
  applyBaseResponse,
  applyTableResponse,
  buildBasePrompt,
  buildTablePrompt,
  parseModelJson,
  planDescriptionTargets,
} from "../../../src/lib/per-space/describe-schema";

const base = { baseId: "appX", name: "Sales CRM", description: null, aiDescription: null, status: "active" };
const tables = [
  { tableId: "tblA", baseId: "appX", name: "Deals", description: null, aiDescription: null, status: "active" },
  { tableId: "tblB", baseId: "appX", name: "Old", description: null, aiDescription: null, status: "removed" },
  { tableId: "tblC", baseId: "appX", name: "Documented", description: "Human wrote this", aiDescription: null, status: "active" },
];
const fields = [
  { fieldId: "fld1", tableId: "tblA", name: "Amount", type: "currency", description: null, aiDescription: null, status: "active" },
  { fieldId: "fld2", tableId: "tblA", name: "Stage", type: "singleSelect", description: "Pipeline stage", aiDescription: null, status: "active" },
  { fieldId: "fld3", tableId: "tblA", name: "Gone", type: "number", description: null, aiDescription: null, status: "removed" },
  { fieldId: "fld4", tableId: "tblA", name: "Done", type: "checkbox", description: null, aiDescription: "already generated", status: "active" },
];

describe("planDescriptionTargets", () => {
  it("targets only active entities with no human AND no AI description", () => {
    const plan = planDescriptionTargets({ base, tables, fields });
    expect(plan.describeBase).toBe(true);
    expect(plan.tableIds).toEqual(["tblA"]); // removed + human-described excluded
    expect(plan.fieldIds).toEqual(["fld1"]); // described/removed/ai-described excluded
  });

  it("targets nothing when everything is described", () => {
    const plan = planDescriptionTargets({
      base: { ...base, aiDescription: "done" },
      tables: [tables[2]],
      fields: [fields[1]],
    });
    expect(plan.describeBase).toBe(false);
    expect(plan.tableIds).toEqual([]);
    expect(plan.fieldIds).toEqual([]);
  });
});

describe("buildTablePrompt", () => {
  it("includes the table, every live field as context, and asks JSON keyed by target ids", () => {
    const p = buildTablePrompt({
      baseName: "Sales CRM",
      table: tables[0],
      fields: fields.filter((f) => f.status === "active"),
      targetFieldIds: ["fld1"],
      describeTable: true,
    });
    expect(p).toContain("Deals");
    expect(p).toContain("Sales CRM");
    expect(p).toContain("Amount");
    expect(p).toContain("currency");
    // existing human descriptions ride along as context
    expect(p).toContain("Pipeline stage");
    // asks for the target field id
    expect(p).toContain("fld1");
    expect(p.toLowerCase()).toContain("json");
  });
});

describe("buildBasePrompt", () => {
  it("includes the base and its table names", () => {
    const p = buildBasePrompt({ base, tableNames: ["Deals", "Contacts"] });
    expect(p).toContain("Sales CRM");
    expect(p).toContain("Deals");
    expect(p).toContain("Contacts");
    expect(p.toLowerCase()).toContain("json");
  });
});

describe("parseModelJson", () => {
  it("parses plain JSON", () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("parses fenced JSON with prose around it", () => {
    expect(parseModelJson('Sure! Here you go:\n```json\n{"table":"x"}\n```\nHope that helps.')).toEqual({ table: "x" });
  });
  it("returns null on garbage (never throws)", () => {
    expect(parseModelJson("I cannot do that")).toBeNull();
    expect(parseModelJson("")).toBeNull();
  });
});

describe("applyTableResponse", () => {
  it("keeps only requested targets, trims, and caps length", () => {
    const out = applyTableResponse(
      { table: "  Tracks deals.  ", fields: { fld1: "Deal value in USD.", fld9: "not requested", fld2: 42 } },
      { targetFieldIds: ["fld1", "fld2"], describeTable: true },
    );
    expect(out.tableDescription).toBe("Tracks deals.");
    expect(out.fieldDescriptions).toEqual({ fld1: "Deal value in USD." }); // fld9 unknown, fld2 non-string
  });
  it("caps overly long descriptions", () => {
    const out = applyTableResponse(
      { table: "x".repeat(2000), fields: {} },
      { targetFieldIds: [], describeTable: true },
    );
    expect(out.tableDescription!.length).toBeLessThanOrEqual(500);
  });
  it("handles null/garbage parses", () => {
    const out = applyTableResponse(null, { targetFieldIds: ["fld1"], describeTable: true });
    expect(out.tableDescription).toBeUndefined();
    expect(out.fieldDescriptions).toEqual({});
  });
});

describe("applyBaseResponse", () => {
  it("extracts a trimmed base description", () => {
    expect(applyBaseResponse({ base: " A CRM. " })).toBe("A CRM.");
    expect(applyBaseResponse(null)).toBeUndefined();
    expect(applyBaseResponse({ base: 7 })).toBeUndefined();
  });
});
