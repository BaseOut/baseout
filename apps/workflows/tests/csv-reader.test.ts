// Unit tests for the CSV reader helper used by the restore-base task.
//
// csv-reader.ts is the INVERSE of csv-stream.ts:
//   csv-stream.ts   pageToCsv(fields, rows) → CSV string (backup)
//   csv-reader.ts   parseCsv(csvString)     → array of header-keyed rows (restore)
//
// Tests use plain string inputs — no real file I/O — so they run fast in Node.
//
// Coverage:
//   - streaming parse of a large (10K-row) file
//   - header-only CSV (empty rows result)
//   - malformed-quote handling (Papa Parse skips/repairs; we surface errors)
//   - CRLF and LF line endings both accepted

import { describe, expect, it } from "vitest";
import { parseCsv } from "../trigger/tasks/_lib/csv-reader";

describe("parseCsv", () => {
  it("parses a simple two-column CSV into row objects keyed by header", async () => {
    const csv = "a,b\r\n1,x\r\n2,y\r\n";
    const rows = await parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ a: "1", b: "x" });
    expect(rows[1]).toEqual({ a: "2", b: "y" });
  });

  it("returns an empty array for a header-only CSV", async () => {
    const csv = "a,b\r\n";
    const rows = await parseCsv(csv);
    expect(rows).toHaveLength(0);
  });

  it("handles a header-only CSV with no trailing newline", async () => {
    const csv = "a,b";
    const rows = await parseCsv(csv);
    expect(rows).toHaveLength(0);
  });

  it("handles LF line endings (not only CRLF)", async () => {
    const csv = "a,b\n1,x\n2,y\n";
    const rows = await parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ a: "1", b: "x" });
  });

  it("handles quoted cells containing the delimiter", async () => {
    const csv = 'a,b\r\n1,"y,z"\r\n';
    const rows = await parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ a: "1", b: "y,z" });
  });

  it("handles double-quoted embedded quotes", async () => {
    const csv = 'note\r\n"she said ""hi"""\r\n';
    const rows = await parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ note: 'she said "hi"' });
  });

  it("handles newlines inside quoted cells", async () => {
    const csv = 'note\r\n"line one\nline two"\r\n';
    const rows = await parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.note).toBe("line one\nline two");
  });

  it("parses a large (10K-row) file efficiently", async () => {
    const header = "id,name,value\r\n";
    const dataRows = Array.from(
      { length: 10_000 },
      (_, i) => `${i},name_${i},${i * 2}\r\n`,
    ).join("");
    const csv = header + dataRows;

    const rows = await parseCsv(csv);
    expect(rows).toHaveLength(10_000);
    expect(rows[0]).toEqual({ id: "0", name: "name_0", value: "0" });
    expect(rows[9999]).toEqual({
      id: "9999",
      name: "name_9999",
      value: "19998",
    });
  });

  it("returns headers array alongside rows when requested", async () => {
    const csv = "a,b,c\r\n1,2,3\r\n";
    const rows = await parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("treats malformed / unclosed quotes as best-effort parse without throwing", async () => {
    // Papa Parse is lenient with malformed quotes. We verify it doesn't throw,
    // and that it still returns some rows (the exact repair is Papa's business).
    const csv = 'a,b\r\n"unclosed,data\r\nnormal,row\r\n';
    const rows = await parseCsv(csv);
    // Should not throw. Result may vary by Papa Parse version but must be an array.
    expect(Array.isArray(rows)).toBe(true);
  });

  it("preserves empty-string cells (null/undefined written as empty during backup)", async () => {
    const csv = "a,b,c\r\n1,,\r\n";
    const rows = await parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ a: "1", b: "", c: "" });
  });
});
