// Unit-level tests for the CSV transformer used by the backup-base
// Trigger.dev task. The task pages records out of Airtable and feeds each
// page through this helper to produce CSV bytes for upload.
//
// Lives under tests/integration/ to match this project's vitest config (the
// include pattern is `tests/integration/**`); pure-function content notwithstanding.

import { describe, expect, it } from "vitest";
import { pageToCsv } from "../../trigger/tasks/_lib/csv-stream";

describe("pageToCsv", () => {
  it("emits header row + data rows in field order", () => {
    const csv = pageToCsv({
      fields: ["a", "b"],
      rows: [
        { a: 1, b: "x" },
        { a: 2, b: "y" },
      ],
    });
    expect(csv).toBe("a,b\r\n1,x\r\n2,y\r\n");
  });

  it("quotes cells that contain the delimiter", () => {
    const csv = pageToCsv({
      fields: ["a", "b"],
      rows: [{ a: 1, b: "y,z" }],
    });
    expect(csv).toBe('a,b\r\n1,"y,z"\r\n');
  });

  it("escapes embedded double quotes by doubling them", () => {
    const csv = pageToCsv({
      fields: ["note"],
      rows: [{ note: 'she said "hi"' }],
    });
    expect(csv).toBe('note\r\n"she said ""hi"""\r\n');
  });

  it("preserves newlines inside quoted cells", () => {
    const csv = pageToCsv({
      fields: ["note"],
      rows: [{ note: "line one\nline two" }],
    });
    expect(csv).toBe('note\r\n"line one\nline two"\r\n');
  });

  it("renders null and undefined as empty cells", () => {
    const csv = pageToCsv({
      fields: ["a", "b", "c"],
      rows: [{ a: 1, b: null, c: undefined }],
    });
    expect(csv).toBe("a,b,c\r\n1,,\r\n");
  });

  it("serializes objects (e.g. linked-record arrays) deterministically", () => {
    // Airtable linked-record fields arrive as arrays of record IDs. Papa Parse
    // serializes arrays via JSON; this test pins that behavior so the
    // backup-base task knows what cells will look like in the output.
    const csv = pageToCsv({
      fields: ["linked"],
      rows: [{ linked: ["rec1", "rec2", "rec3"] }],
    });
    expect(csv).toBe('linked\r\n"[""rec1"",""rec2"",""rec3""]"\r\n');
  });

  it("emits header-only CSV when given an empty rows array", () => {
    // The backup-base task issues one CSV per table even when the table is
    // empty — restore code can detect an empty table from the header-only
    // file rather than a missing object.
    const csv = pageToCsv({ fields: ["a", "b"], rows: [] });
    expect(csv).toBe("a,b\r\n");
  });

  it("only includes the requested fields, in the requested order", () => {
    // Records may carry fields the schema doesn't list (Airtable can add
    // computed fields, etc.). The helper must follow the explicit field list,
    // not the row keys, and must respect ordering.
    const csv = pageToCsv({
      fields: ["b", "a"],
      rows: [{ a: 1, b: 2, c: 3 }],
    });
    expect(csv).toBe("b,a\r\n2,1\r\n");
  });
});
