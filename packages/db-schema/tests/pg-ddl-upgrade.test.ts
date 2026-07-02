import { describe, it, expect } from "vitest";
import { spacePgDdlStatements } from "../src/space/pg-ddl";
import { spacePgDdlStatementsIdempotent } from "../src/space/pg-ddl-upgrade";

describe("spacePgDdlStatementsIdempotent", () => {
  it("rewrites every CREATE to an IF NOT EXISTS variant", () => {
    const out = spacePgDdlStatementsIdempotent();
    for (const stmt of out) {
      if (stmt.startsWith("CREATE TABLE")) {
        expect(stmt.startsWith("CREATE TABLE IF NOT EXISTS")).toBe(true);
      }
      if (stmt.startsWith("CREATE INDEX")) {
        expect(stmt.startsWith("CREATE INDEX IF NOT EXISTS")).toBe(true);
      }
      if (stmt.startsWith("CREATE UNIQUE INDEX")) {
        expect(stmt.startsWith("CREATE UNIQUE INDEX IF NOT EXISTS")).toBe(true);
      }
    }
  });

  it("preserves the statement count + the same tables", () => {
    const base = spacePgDdlStatements();
    const idem = spacePgDdlStatementsIdempotent();
    expect(idem).toHaveLength(base.length);
    // every base CREATE TABLE name still appears
    const tableName = (s: string) => s.match(/CREATE TABLE (?:IF NOT EXISTS )?"([^"]+)"/)?.[1];
    expect(idem.map(tableName).filter(Boolean).sort()).toEqual(
      base.map(tableName).filter(Boolean).sort(),
    );
  });

  it("does not introduce IF NOT EXISTS twice", () => {
    for (const stmt of spacePgDdlStatementsIdempotent()) {
      expect((stmt.match(/IF NOT EXISTS/g) ?? []).length).toBeLessThanOrEqual(1);
    }
  });

  it("covers all 27 tables (idempotent set matches the schema)", () => {
    const tables = spacePgDdlStatementsIdempotent().filter((s) => s.startsWith("CREATE TABLE"));
    expect(tables).toHaveLength(27);
  });
});
