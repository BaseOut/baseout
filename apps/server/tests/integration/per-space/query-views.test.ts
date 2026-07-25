// Pure-module tests for the per-table query-view generator
// (system-per-space-db §4.2). SQL-string builders only — the drizzle applier
// (query-views-io.ts) runs inside withSpaceSchema and is smoke-verified, the
// describe-schema-io precedent.

import { describe, it, expect } from "vitest";
import {
  planViewNames,
  queryViewHelperStatements,
  buildQueryViewStatements,
  dropStaleViewStatements,
} from "../../../src/lib/per-space/query-views";

const T = (tableId: string, name: string) => ({ tableId, name });
const F = (fieldId: string, name: string, type: string) => ({ fieldId, name, type });

describe("planViewNames — clean raw Airtable names, sanitized + deduped", () => {
  it("lowercases and replaces non-identifier chars with _", () => {
    const names = planViewNames([T("tblA", "Deal Flow (2026)")]);
    expect(names.get("tblA")).toBe("deal_flow__2026_");
  });

  it("dedupes collisions deterministically by tableId order", () => {
    const names = planViewNames([T("tblB", "Deals"), T("tblA", "deals")]);
    // Sorted by tableId: tblA wins the clean name regardless of input order.
    expect(names.get("tblA")).toBe("deals");
    expect(names.get("tblB")).toBe("deals_2");
  });

  it("guards reserved prefixes so a view can never shadow a bo_at_* table", () => {
    const names = planViewNames([T("tblA", "bo_at_records"), T("tblB", "pg_class")]);
    expect(names.get("tblA")).toBe("v_bo_at_records");
    expect(names.get("tblB")).toBe("v_pg_class");
  });

  it("falls back to a tableId-derived name when the name sanitizes to nothing", () => {
    const names = planViewNames([T("tblXYZ", "🚀🚀")]);
    expect(names.get("tblXYZ")).toBe("table_tblxyz");
  });

  it("truncates to 63 chars (Postgres identifier limit) before deduping", () => {
    const long = "x".repeat(80);
    const names = planViewNames([T("tblA", long), T("tblB", long)]);
    expect(names.get("tblA")!.length).toBeLessThanOrEqual(63);
    expect(names.get("tblB")!.length).toBeLessThanOrEqual(63);
    expect(names.get("tblA")).not.toBe(names.get("tblB"));
  });
});

describe("buildQueryViewStatements — safe-cast matview over the EAV cells", () => {
  it("emits DROP IF EXISTS then CREATE MATERIALIZED VIEW", () => {
    const [drop, create] = buildQueryViewStatements("deals", "tblA", [
      F("fld1", "Name", "singleLineText"),
    ]);
    expect(drop).toBe(`DROP MATERIALIZED VIEW IF EXISTS "deals"`);
    expect(create).toContain(`CREATE MATERIALIZED VIEW "deals" AS`);
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

  it("safe-casts numeric types behind a jsonb_typeof guard (NULL on mismatch)", () => {
    for (const type of ["number", "currency", "percent", "duration", "rating", "count", "autoNumber"]) {
      const [, create] = buildQueryViewStatements("t", "tblA", [F("fld9", "Amt", type)]);
      expect(create).toContain(
        `CASE WHEN jsonb_typeof(c.vals -> 'fld9') = 'number' THEN (c.vals -> 'fld9')::numeric END AS "amt"`,
      );
    }
  });

  it("safe-casts checkbox behind a jsonb_typeof guard", () => {
    const [, create] = buildQueryViewStatements("t", "tblA", [F("fld3", "Done?", "checkbox")]);
    expect(create).toContain(
      `CASE WHEN jsonb_typeof(c.vals -> 'fld3') = 'boolean' THEN (c.vals -> 'fld3')::boolean END AS "done_"`,
    );
  });

  it("safe-casts date/dateTime via the plpgsql try-functions (a retyped field can hold non-conforming old values)", () => {
    const [, create] = buildQueryViewStatements("t", "tblA", [
      F("fld4", "Due", "date"),
      F("fld5", "Created", "createdTime"),
      F("fld6", "Modified", "lastModifiedTime"),
      F("fld7", "At", "dateTime"),
    ]);
    expect(create).toContain(`bo_at_try_date(c.vals -> 'fld4' #>> '{}') AS "due"`);
    expect(create).toContain(`bo_at_try_timestamptz(c.vals -> 'fld5' #>> '{}') AS "created"`);
    expect(create).toContain(`bo_at_try_timestamptz(c.vals -> 'fld6' #>> '{}') AS "modified"`);
    expect(create).toContain(`bo_at_try_timestamptz(c.vals -> 'fld7' #>> '{}') AS "at"`);
  });

  it("passes structured types through as jsonb", () => {
    const [, create] = buildQueryViewStatements("t", "tblA", [
      F("fld8", "Links", "multipleRecordLinks"),
      F("fld9", "Files", "multipleAttachments"),
    ]);
    expect(create).toContain(`c.vals -> 'fld8' AS "links"`);
    expect(create).toContain(`c.vals -> 'fld9' AS "files"`);
  });

  it("defaults unknown types to text extraction", () => {
    const [, create] = buildQueryViewStatements("t", "tblA", [F("fldA", "Note", "someFutureType")]);
    expect(create).toContain(`c.vals -> 'fldA' #>> '{}' AS "note"`);
  });

  it("dedupes column names against the reserved projection columns", () => {
    const [, create] = buildQueryViewStatements("t", "tblA", [
      F("fld1", "Record ID", "singleLineText"),
      F("fld2", "record_id", "singleLineText"),
    ]);
    expect(create).toContain(`AS "record_id_2"`);
    expect(create).toContain(`AS "record_id_3"`);
  });

  it("decodes cells with the try-jsonb helper so one bad value cannot break the whole view", () => {
    const [, create] = buildQueryViewStatements("t", "tblA", [F("fld1", "Name", "singleLineText")]);
    expect(create).toContain("bo_at_try_jsonb(value)");
  });

  it("escapes single quotes in interpolated ids", () => {
    const [, create] = buildQueryViewStatements("t", "tbl'; DROP TABLE x; --", [
      F("fld'1", "Name", "singleLineText"),
    ]);
    expect(create).toContain(`'tbl''; DROP TABLE x; --'`);
    expect(create).toContain(`'fld''1'`);
    expect(create).not.toContain(`'fld'1'`);
  });
});

describe("queryViewHelperStatements — idempotent per-schema safe-cast functions", () => {
  it("uses CREATE OR REPLACE (re-runnable every regeneration)", () => {
    const stmts = queryViewHelperStatements();
    expect(stmts.length).toBeGreaterThanOrEqual(3);
    for (const s of stmts) expect(s).toContain("CREATE OR REPLACE FUNCTION bo_at_try_");
  });

  it("returns NULL on cast failure (EXCEPTION handler)", () => {
    for (const s of queryViewHelperStatements()) {
      expect(s).toContain("EXCEPTION WHEN others THEN RETURN NULL");
    }
  });
});

describe("dropStaleViewStatements — removed/renamed tables lose their views", () => {
  it("drops existing matviews not in the expected set", () => {
    const stmts = dropStaleViewStatements(["deals", "old_deals"], new Set(["deals"]));
    expect(stmts).toEqual([`DROP MATERIALIZED VIEW IF EXISTS "old_deals"`]);
  });

  it("is empty when everything matches", () => {
    expect(dropStaleViewStatements(["deals"], new Set(["deals"]))).toEqual([]);
  });
});
