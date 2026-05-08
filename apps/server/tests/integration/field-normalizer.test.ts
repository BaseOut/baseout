// Field-value normalization for the backup-base task.
//
// Airtable returns rich field shapes (record IDs, attachment objects, etc.).
// CSV needs strings or scalars. The plan (Phase 7.3) calls out two specific
// transforms — everything else passes through to csv-stream, which
// JSON-stringifies remaining arrays / objects.

import { describe, expect, it } from "vitest";
import { normalizeFieldValue } from "../../trigger/tasks/_lib/field-normalizer";

describe("normalizeFieldValue", () => {
  it("passes through scalars unchanged regardless of field type", () => {
    expect(normalizeFieldValue("foo", "singleLineText")).toBe("foo");
    expect(normalizeFieldValue(42, "number")).toBe(42);
    expect(normalizeFieldValue(true, "checkbox")).toBe(true);
    expect(normalizeFieldValue(null, "singleLineText")).toBe(null);
    expect(normalizeFieldValue(undefined, "singleLineText")).toBe(undefined);
  });

  it("joins multipleRecordLinks as comma-separated record IDs", () => {
    expect(
      normalizeFieldValue(["recABC", "recDEF"], "multipleRecordLinks"),
    ).toBe("recABC,recDEF");
    expect(normalizeFieldValue([], "multipleRecordLinks")).toBe("");
    expect(normalizeFieldValue(["recXYZ"], "multipleRecordLinks")).toBe(
      "recXYZ",
    );
  });

  it("replaces multipleAttachments with [N attachments] placeholder", () => {
    expect(
      normalizeFieldValue(
        [{ id: "att1" }, { id: "att2" }, { id: "att3" }],
        "multipleAttachments",
      ),
    ).toBe("[3 attachments]");
    expect(normalizeFieldValue([], "multipleAttachments")).toBe(
      "[0 attachments]",
    );
  });

  it("falls through unrecognized field types as-is (csv-stream JSON-stringifies)", () => {
    expect(
      normalizeFieldValue(["a", "b"], "multipleSelects"),
    ).toEqual(["a", "b"]);
    expect(
      normalizeFieldValue({ id: "u1", name: "Alice" }, "singleCollaborator"),
    ).toEqual({ id: "u1", name: "Alice" });
  });

  it("is defensive about shape mismatches — doesn't crash on bad input", () => {
    // Non-array under a multi-type → pass through. Caller's bug, not ours.
    expect(
      normalizeFieldValue("not-an-array", "multipleRecordLinks"),
    ).toBe("not-an-array");
    expect(normalizeFieldValue(null, "multipleAttachments")).toBe(null);
  });
});
