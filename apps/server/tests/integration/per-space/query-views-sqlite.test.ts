// Pure-module tests for the D1/SQLite per-table query-view generator
// (server-d1-backend 4.2) — the live-pivot counterpart of query-views.test.ts.
// SQL-string builders only; application rides the future D1 write path.

import { describe, it, expect } from "vitest";
import {
  planViewNames,
  buildQueryViewStatements,
  dropStaleViewStatements,
} from "../../../src/lib/per-space/query-views-sqlite";

const T = (tableId: string, name: string) => ({ tableId, name });
const F = (fieldId: string, name: string, type: string) => ({ fieldId, name, type });

describe("planViewNames (sqlite) — same names as the pg planner, plus the sqlite_ guard", () => {
  it("lowercases and replaces non-identifier chars with _", () => {
    const names = planViewNames([T("tblA", "Deal Flow (2026)")]);
    expect(names.get("tblA")).toBe("deal_flow__2026_");
  });

  it("dedupes collisions deterministically by tableId order", () => {
    const names = planViewNames([T("tblB", "Deals"), T("tblA", "deals")]);
    expect(names.get("tblA")).toBe("deals");
    expect(names.get("tblB")).toBe("deals_2");
  });

  it("guards bo_at_/pg_ prefixes (name parity with managed_pg) AND sqlite_ (reserved in SQLite)", () => {
    const names = planViewNames([
      T("tblA", "bo_at_records"),
      T("tblB", "pg_class"),
      T("tblC", "sqlite_master"),
    ]);
    expect(names.get("tblA")).toBe("v_bo_at_records");
    expect(names.get("tblB")).toBe("v_pg_class");
    expect(names.get("tblC")).toBe("v_sqlite_master");
  });

  it("falls back to a tableId-derived name when the name sanitizes to nothing", () => {
    const names = planViewNames([T("tblXYZ", "🚀🚀")]);
    expect(names.get("tblXYZ")).toBe("table_tblxyz");
  });

  it("truncates to 63 chars (kept in lockstep with pg for cross-backend name parity)", () => {
    const long = "x".repeat(80);
    const names = planViewNames([T("tblA", long), T("tblB", long)]);
    expect(names.get("tblA")!.length).toBeLessThanOrEqual(63);
    expect(names.get("tblB")!.length).toBeLessThanOrEqual(63);
    expect(names.get("tblA")).not.toBe(names.get("tblB"));
  });
});

describe("buildQueryViewStatements (sqlite) — safe-cast live pivot over the EAV cells", () => {
  it("emits DROP VIEW IF EXISTS then CREATE VIEW (no matviews in SQLite)", () => {
    const [drop, create] = buildQueryViewStatements("deals", "tblA", [
      F("fld1", "Name", "singleLineText"),
    ]);
    expect(drop).toBe(`DROP VIEW IF EXISTS "deals"`);
    expect(create).toContain(`CREATE VIEW "deals" AS`);
    expect(create).toContain("FROM bo_at_records r");
    expect(create).toContain("bo_at_record_field_data");
    expect(create).toContain(`r.table_id = 'tblA' AND r.status = 'active'`);
  });

  it("always projects record_id, created_time, modified_time", () => {
    const [, create] = buildQueryViewStatements("deals", "tblA", []);
    expect(create).toContain("r.record_id");
    expect(create).toContain("r.created_time");
    expect(create).toContain("r.modified_time");
  });

  it("safe-casts numeric types behind a json_type guard (NULL on mismatch)", () => {
    for (const type of ["number", "currency", "percent", "duration", "rating", "count", "autoNumber"]) {
      const [, create] = buildQueryViewStatements("t", "tblA", [F("fld9", "Amt", type)]);
      expect(create).toContain(
        `CASE WHEN json_type(c.vals, '$."fld9"') IN ('integer', 'real') THEN json_extract(c.vals, '$."fld9"') END AS "amt"`,
      );
    }
  });

  it("safe-casts checkbox behind a json_type guard (SQLite booleans read back as 1/0)", () => {
    const [, create] = buildQueryViewStatements("t", "tblA", [F("fld3", "Done?", "checkbox")]);
    expect(create).toContain(
      `CASE WHEN json_type(c.vals, '$."fld3"') IN ('true', 'false') THEN json_extract(c.vals, '$."fld3"') END AS "done_"`,
    );
  });

  it("guards date/dateTime to text (ISO strings; SQLite has no date type, lexicographic order is correct)", () => {
    const [, create] = buildQueryViewStatements("t", "tblA", [
      F("fld4", "Due", "date"),
      F("fld5", "Created", "createdTime"),
      F("fld6", "Modified", "lastModifiedTime"),
      F("fld7", "At", "dateTime"),
    ]);
    for (const fld of ["fld4", "fld5", "fld6", "fld7"]) {
      expect(create).toContain(
        `CASE WHEN json_type(c.vals, '$."${fld}"') = 'text' THEN json_extract(c.vals, '$."${fld}"') END`,
      );
    }
  });

  it("passes structured types through as their JSON text", () => {
    const [, create] = buildQueryViewStatements("t", "tblA", [
      F("fld8", "Links", "multipleRecordLinks"),
      F("fld9", "Files", "multipleAttachments"),
    ]);
    expect(create).toContain(`json_extract(c.vals, '$."fld8"') AS "links"`);
    expect(create).toContain(`json_extract(c.vals, '$."fld9"') AS "files"`);
  });

  it("defaults unknown types to plain extraction", () => {
    const [, create] = buildQueryViewStatements("t", "tblA", [F("fldA", "Note", "someFutureType")]);
    expect(create).toContain(`json_extract(c.vals, '$."fldA"') AS "note"`);
  });

  it("dedupes column names against the reserved projection columns", () => {
    const [, create] = buildQueryViewStatements("t", "tblA", [
      F("fld1", "Record ID", "singleLineText"),
      F("fld2", "record_id", "singleLineText"),
    ]);
    expect(create).toContain(`AS "record_id_2"`);
    expect(create).toContain(`AS "record_id_3"`);
  });

  it("decodes cells behind json_valid so one bad value cannot break the whole view", () => {
    const [, create] = buildQueryViewStatements("t", "tblA", [F("fld1", "Name", "singleLineText")]);
    expect(create).toContain("CASE WHEN json_valid(value) THEN json(value) END");
  });

  it("escapes single quotes in interpolated ids and strips double quotes from json paths", () => {
    const [, create] = buildQueryViewStatements("t", `tbl'; DROP TABLE x; --`, [
      F(`fld'"1`, "Name", "singleLineText"),
    ]);
    expect(create).toContain(`'tbl''; DROP TABLE x; --'`);
    expect(create).toContain(`'$."fld''1"'`); // ' doubled for SQL, " stripped from the path label
    expect(create).not.toContain(`'$."fld'"1"'`);
  });
});

describe("dropStaleViewStatements (sqlite) — removed/renamed tables lose their views", () => {
  it("drops existing views not in the expected set", () => {
    const stmts = dropStaleViewStatements(["deals", "old_deals"], new Set(["deals"]));
    expect(stmts).toEqual([`DROP VIEW IF EXISTS "old_deals"`]);
  });

  it("is empty when everything matches", () => {
    expect(dropStaleViewStatements(["deals"], new Set(["deals"]))).toEqual([]);
  });
});
