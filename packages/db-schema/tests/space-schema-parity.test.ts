import { describe, it, expect } from "vitest";
import { is, Table, getTableName, getTableColumns } from "drizzle-orm";
import * as pg from "../src/space/pg";
import * as sqlite from "../src/space/sqlite";

// The per-Space schema is authored twice (Postgres + SQLite/D1). The two dialects
// MUST stay in lockstep — same tables, same columns, same export keys — so a Space
// can migrate between backends by row-copy without a model change. This test is the
// enforcement: it fails the moment the dialects drift.

type Shape = {
  exportKeys: string[];
  tablesByExport: Record<string, string>; // export key → SQL table name
  columnsByTable: Record<string, string[]>; // SQL table name → sorted SQL column names
};

function shapeOf(mod: Record<string, unknown>): Shape {
  const exportKeys: string[] = [];
  const tablesByExport: Record<string, string> = {};
  const columnsByTable: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(mod)) {
    if (!is(value, Table)) continue;
    const sqlName = getTableName(value);
    exportKeys.push(key);
    tablesByExport[key] = sqlName;
    columnsByTable[sqlName] = Object.values(getTableColumns(value))
      .map((col) => col.name)
      .sort();
  }

  exportKeys.sort();
  return { exportKeys, tablesByExport, columnsByTable };
}

describe("per-Space schema parity (pg ↔ sqlite)", () => {
  const pgShape = shapeOf(pg as Record<string, unknown>);
  const sqliteShape = shapeOf(sqlite as Record<string, unknown>);

  it("exports the same table set under the same keys", () => {
    expect(sqliteShape.exportKeys).toEqual(pgShape.exportKeys);
    expect(sqliteShape.tablesByExport).toEqual(pgShape.tablesByExport);
  });

  it("every table has identical SQL column names across dialects", () => {
    expect(Object.keys(sqliteShape.columnsByTable).sort()).toEqual(
      Object.keys(pgShape.columnsByTable).sort(),
    );
    for (const [table, cols] of Object.entries(pgShape.columnsByTable)) {
      expect(sqliteShape.columnsByTable[table], `columns for ${table}`).toEqual(cols);
    }
  });

  it("uses the bo_at_ prefix on every per-Space table", () => {
    for (const name of Object.values(pgShape.tablesByExport)) {
      expect(name.startsWith("bo_at_"), `${name} must be bo_at_-prefixed`).toBe(true);
    }
  });
});
