// TDD (CLAUDE.md §3.4) — RED first: the human-safe CSV guard for the portable
// export archive (shared-data-portability task 2.1, design D5).
//
// The backup pipeline's pageToCsv (_lib/csv-stream.ts) is deliberately
// UNGUARDED — correct for the machine round-trip restore reads back. A portable
// archive is handed to a human to open in Excel/Sheets, a different threat
// surface (OWASP CSV Injection). So the bundler re-emits every cell through
// this guard rather than copying snapshot CSV bytes verbatim.
//
// This is a fresh re-implementation of the escapeCsvCell / FORMULA_TRIGGERS
// semantics shipped for schema export (apps/web/src/lib/csv.ts) — apps/web is
// not importable from apps/workflows, and per the task this is re-implemented
// once here rather than extracted.

import { describe, expect, it } from "vitest";
import {
  escapeCsvCell,
  FORMULA_TRIGGERS,
  formatGuardedCsv,
  reguardCsv,
} from "../trigger/tasks/_lib/export-csv-guard";

describe("escapeCsvCell", () => {
  it("neutralizes every leading formula trigger with a single quote", () => {
    // The classic spreadsheet-formula trigger characters plus the whitespace
    // triggers Excel/Sheets also treat as formula starts.
    expect(escapeCsvCell("=1+1")).toBe("\"'=1+1\"");
    expect(escapeCsvCell("+1")).toBe("\"'+1\"");
    expect(escapeCsvCell("-1")).toBe("\"'-1\"");
    expect(escapeCsvCell("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
    expect(escapeCsvCell("\tcmd")).toBe("\"'\tcmd\"");
    expect(escapeCsvCell("\rcmd")).toBe("\"'\rcmd\"");
    expect(escapeCsvCell("\ncmd")).toBe("\"'\ncmd\"");
  });

  it("exposes the exact trigger set", () => {
    expect(FORMULA_TRIGGERS).toEqual(["=", "+", "-", "@", "\t", "\r", "\n"]);
  });

  it("does not prefix a value whose trigger is not leading", () => {
    expect(escapeCsvCell("1+1")).toBe('"1+1"');
    expect(escapeCsvCell("a=b")).toBe('"a=b"');
  });

  it("doubles inner double-quotes per RFC-4180", () => {
    expect(escapeCsvCell('she said "hi"')).toBe('"she said ""hi"""');
  });

  it("always wraps in quotes so commas and newlines survive", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("renders null and undefined as an empty quoted cell", () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });

  it("stringifies non-string primitives", () => {
    expect(escapeCsvCell(42)).toBe('"42"');
    expect(escapeCsvCell(true)).toBe('"true"');
  });

  it("neutralizes a quote-then-formula payload (guard runs before quoting)", () => {
    // Leading '=' is neutralized; the inner double-quote is then doubled.
    expect(escapeCsvCell('="a"')).toBe("\"'=\"\"a\"\"\"");
  });
});

describe("formatGuardedCsv", () => {
  it("emits a CRLF-terminated RFC-4180 document with a guarded header + rows", () => {
    const out = formatGuardedCsv(
      ["Name", "Formula"],
      [
        ["Alice", "=1+1"],
        ["Bob", "plain"],
      ],
    );
    expect(out).toBe(
      '"Name","Formula"\r\n"Alice","\'=1+1"\r\n"Bob","plain"\r\n',
    );
  });

  it("emits a header-only document (trailing CRLF) for zero rows", () => {
    expect(formatGuardedCsv(["A", "B"], [])).toBe('"A","B"\r\n');
  });
});

describe("reguardCsv", () => {
  it("re-emits an unguarded snapshot CSV through the guard and counts rows", () => {
    // Shape produced by the backup pipeline's pageToCsv: quoted, CRLF, and a
    // formula cell that is NOT neutralized (machine round-trip).
    const snapshot = '"Name","Note"\r\n"Alice","=danger()"\r\n"Bob","ok"\r\n';
    const { content, recordCount } = reguardCsv(snapshot);
    expect(recordCount).toBe(2);
    expect(content).toBe(
      '"Name","Note"\r\n"Alice","\'=danger()"\r\n"Bob","ok"\r\n',
    );
  });

  it("counts zero records for a header-only CSV and preserves the header", () => {
    const { content, recordCount } = reguardCsv('"A","B"\r\n');
    expect(recordCount).toBe(0);
    expect(content).toBe('"A","B"\r\n');
  });

  it("preserves embedded commas/newlines when re-emitting", () => {
    const snapshot = '"Name","Note"\r\n"Al, ice","two\nlines"\r\n';
    const { content, recordCount } = reguardCsv(snapshot);
    expect(recordCount).toBe(1);
    expect(content).toBe('"Name","Note"\r\n"Al, ice","two\nlines"\r\n');
  });
});
