// Unit tests for the field denormalizer used by the restore-base task.
//
// field-denormalizer.ts is the INVERSE of field-normalizer.ts:
//   normalizeFieldValue(value, type)   → CSV-friendly scalar (backup)
//   denormalizeFieldValue(cell, type)  → Airtable-typed value (restore)
//
// CSV cells are always strings (everything comes through parseCsv as strings).
// The denormalizer converts back to Airtable's expected field shapes.
//
// attachment cells → passthrough as-is (placeholder string only).
// Actual attachment re-upload is DEFERRED per the links-only MVP decision.

import { describe, expect, it } from "vitest";
import { denormalizeFieldValue } from "../trigger/tasks/_lib/field-denormalizer";

describe("denormalizeFieldValue", () => {
  it("passes through string scalars unchanged for text field types", () => {
    expect(denormalizeFieldValue("foo", "singleLineText")).toBe("foo");
    expect(denormalizeFieldValue("hello world", "multilineText")).toBe(
      "hello world",
    );
    expect(denormalizeFieldValue("", "singleLineText")).toBe("");
  });

  it("converts numeric string back to number for number fields", () => {
    expect(denormalizeFieldValue("42", "number")).toBe(42);
    expect(denormalizeFieldValue("3.14", "number")).toBe(3.14);
    expect(denormalizeFieldValue("0", "number")).toBe(0);
  });

  it("converts checkbox string back to boolean", () => {
    expect(denormalizeFieldValue("true", "checkbox")).toBe(true);
    expect(denormalizeFieldValue("false", "checkbox")).toBe(false);
  });

  it("returns empty string as-is for empty cells across all types", () => {
    // Empty CSV cell → don't try to parse; return empty string so the caller
    // can decide to skip or pass through to Airtable (which ignores empty fields).
    expect(denormalizeFieldValue("", "number")).toBe("");
    expect(denormalizeFieldValue("", "checkbox")).toBe("");
    expect(denormalizeFieldValue("", "multipleRecordLinks")).toBe("");
    expect(denormalizeFieldValue("", "multipleSelects")).toBe("");
  });

  it("splits semicolon-joined multi-select back to array", () => {
    // backup stores multipleSelects as JSON array stringified by csv-stream.
    // denormalize parses it back.
    const cell = JSON.stringify(["Option A", "Option B", "Option C"]);
    const result = denormalizeFieldValue(cell, "multipleSelects");
    expect(result).toEqual(["Option A", "Option B", "Option C"]);
  });

  it("splits comma-joined multipleRecordLinks back to array of record IDs", () => {
    // field-normalizer joined linked IDs with commas.
    expect(
      denormalizeFieldValue("recABC,recDEF", "multipleRecordLinks"),
    ).toEqual(["recABC", "recDEF"]);
    expect(denormalizeFieldValue("recXYZ", "multipleRecordLinks")).toEqual([
      "recXYZ",
    ]);
  });

  it("passes through attachment placeholder string as-is (deferred re-upload)", () => {
    // The backup task writes "[3 attachments]" — restore can't re-upload,
    // so it passes through the text as-is. The resulting Airtable cell will
    // be a text string, not an attachment cell.
    expect(
      denormalizeFieldValue("[3 attachments]", "multipleAttachments"),
    ).toBe("[3 attachments]");
    expect(
      denormalizeFieldValue("[0 attachments]", "multipleAttachments"),
    ).toBe("[0 attachments]");
  });

  it("round-trips date strings unchanged", () => {
    expect(denormalizeFieldValue("2026-06-24", "date")).toBe("2026-06-24");
  });

  it("round-trips datetime strings unchanged", () => {
    expect(
      denormalizeFieldValue("2026-06-24T10:30:00.000Z", "dateTime"),
    ).toBe("2026-06-24T10:30:00.000Z");
  });

  it("parses JSON-stringified arrays for multipleSelects with single item", () => {
    const cell = JSON.stringify(["Solo"]);
    expect(denormalizeFieldValue(cell, "multipleSelects")).toEqual(["Solo"]);
  });

  it("falls through unrecognized field types as-is", () => {
    // Unknown types: pass the raw string through to Airtable with typecast.
    expect(denormalizeFieldValue("some value", "unknownType")).toBe(
      "some value",
    );
    expect(
      denormalizeFieldValue('{"id":"u1","name":"Alice"}', "singleCollaborator"),
    ).toBe('{"id":"u1","name":"Alice"}');
  });

  it("is defensive about bad inputs — does not crash", () => {
    // non-numeric string for number field → return as-is
    expect(denormalizeFieldValue("not-a-number", "number")).toBe(
      "not-a-number",
    );
    // non-boolean string for checkbox → return as-is
    expect(denormalizeFieldValue("yes", "checkbox")).toBe("yes");
    // non-JSON for multipleSelects → return raw string
    expect(denormalizeFieldValue("not-json", "multipleSelects")).toBe(
      "not-json",
    );
  });
});
