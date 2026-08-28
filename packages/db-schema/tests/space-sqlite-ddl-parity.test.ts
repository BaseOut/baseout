import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  SPACE_SQLITE_DDL,
  spaceSqliteDdlStatements,
} from "../src/space/sqlite-ddl";

const MIG_DIR = resolve(__dirname, "../migrations/space-sqlite");

function migrationSql(): string {
  const file = readdirSync(MIG_DIR).find((f) => f.endsWith(".sql"));
  if (!file) throw new Error(`no .sql migration in ${MIG_DIR}`);
  return readFileSync(resolve(MIG_DIR, file), "utf8");
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

describe("per-Space SQLite DDL ↔ migration parity", () => {
  it("bundled SPACE_SQLITE_DDL matches the generated migration", () => {
    const fromMigration = migrationSql()
      .split("--> statement-breakpoint")
      .map(norm)
      .filter(Boolean);
    const fromModule = spaceSqliteDdlStatements().map(norm);
    expect(fromModule).toEqual(fromMigration);
  });

  it("covers all 45 bo_at_ tables", () => {
    const creates = (SPACE_SQLITE_DDL.match(/CREATE TABLE/g) ?? []).length;
    expect(creates).toBe(45);
  });
});
