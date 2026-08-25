// D1 schema data-plane I/O (server-d1-data-plane) — runs against a REAL local
// D1 (miniflare TEST_D1 binding) with the REAL bundled provisioner DDL, so
// every run re-proves the DDL applies cleanly AND the statements carry real
// D1/SQLite semantics. The sync round-trips go through the actual diffSchema.

import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { spaceSqliteDdlStatements } from "@baseout/db-schema/space/sqlite-ddl";
import type { SpaceD1Executor } from "../../../src/lib/per-space/d1-query";
import { diffSchema, type CapturedBase } from "../../../src/lib/per-space/schema-diff";
import {
  applySchemaDiff,
  ensureBaseRun,
  readAllEntities,
  readSchemaWorkingSet,
  regenerateQueryViews,
} from "../../../src/lib/per-space/space-db-d1";

const d1 = (env as unknown as { TEST_D1: D1Database }).TEST_D1;

const exec: SpaceD1Executor = {
  query: async (sql, params = []) => {
    const res = await d1.prepare(sql).bind(...(params as unknown[])).all();
    return res.results ?? [];
  },
  batch: async (stmts) => {
    for (const s of stmts) await d1.prepare(s.sql).bind(...((s.params ?? []) as unknown[])).run();
  },
};

const RUN_A = "11111111-1111-4111-8111-11111111111a";
const RUN_B = "11111111-1111-4111-8111-11111111111b";

const CAPTURED: CapturedBase = {
  baseId: "appBase1",
  name: "CRM",
  tables: [
    {
      tableId: "tblDeals",
      name: "Deals",
      primaryFieldId: "fldName",
      fields: [
        { fieldId: "fldName", name: "Name", type: "singleLineText" },
        { fieldId: "fldAmt", name: "Amount", type: "currency", options: { symbol: "$" } },
      ],
      views: [{ viewId: "viwAll", name: "All deals", type: "grid" }],
    },
  ],
};

beforeEach(async () => {
  // The pool's D1 persists across tests in this file — drop every user object,
  // then apply the bundled DDL fresh (which also re-proves it applies cleanly).
  const objects = (await d1
    .prepare(`SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`)
    .all()).results as { name: string; type: string }[];
  for (const o of objects.filter((x) => x.type === "view")) {
    await d1.prepare(`DROP VIEW IF EXISTS "${o.name}"`).run();
  }
  for (const o of objects.filter((x) => x.type === "table")) {
    await d1.prepare(`DROP TABLE IF EXISTS "${o.name}"`).run();
  }
  for (const sql of spaceSqliteDdlStatements()) await d1.prepare(sql).run();
});

async function syncOnce(backupRunId: string, captured: CapturedBase) {
  const baseRunId = await ensureBaseRun(exec, backupRunId, captured.baseId);
  const prior = await readSchemaWorkingSet(exec, captured.baseId);
  const result = diffSchema({
    captured,
    prior,
    runId: baseRunId,
    confident: true,
    includeViews: true,
  });
  const { schemaVersionId } = await applySchemaDiff(exec, {
    baseId: captured.baseId,
    baseRunId,
    result,
    schemaJson: captured,
  });
  return { baseRunId, result, schemaVersionId };
}

describe("ensureBaseRun", () => {
  it("creates once and is idempotent per (backup_run, base)", async () => {
    const first = await ensureBaseRun(exec, RUN_A, "appBase1");
    const again = await ensureBaseRun(exec, RUN_A, "appBase1");
    const other = await ensureBaseRun(exec, RUN_B, "appBase1");
    expect(again).toBe(first);
    expect(other).not.toBe(first);
  });
});

describe("schema sync round-trip on real D1", () => {
  it("first sync lands the full working set + a schema_versions row", async () => {
    const { result, schemaVersionId } = await syncOnce(RUN_A, CAPTURED);
    expect(result.schemaChanged).toBe(true);
    expect(schemaVersionId).not.toBeNull();

    const ws = await readSchemaWorkingSet(exec, "appBase1");
    expect(ws.base).toMatchObject({ baseId: "appBase1", name: "CRM", status: "active" });
    expect(ws.tables).toHaveLength(1);
    expect(ws.tables[0]).toMatchObject({ tableId: "tblDeals", primaryFieldId: "fldName" });
    expect(ws.fields).toHaveLength(2);
    const amt = ws.fields.find((f) => f.fieldId === "fldAmt")!;
    expect(amt.options).toEqual({ symbol: "$" }); // JSON round-trips through the text column
    expect(ws.views).toEqual([
      expect.objectContaining({ viewId: "viwAll", tableId: "tblDeals", status: "active" }),
    ]);
  });

  it("re-syncing the identical capture converges (idempotent, no dup version rows)", async () => {
    const first = await syncOnce(RUN_A, CAPTURED);
    const second = await syncOnce(RUN_B, CAPTURED);
    // Note: schemaChanged stays true (the route never passes priorSchemaHash —
    // same as pg); convergence is the version-row dedupe + upsert idempotency.
    expect(second.schemaVersionId).toBe(first.schemaVersionId);
    const versions = await exec.query(`SELECT id FROM bo_at_schema_versions`);
    expect(versions).toHaveLength(1);
    const ws = await readSchemaWorkingSet(exec, "appBase1");
    expect(ws.fields).toHaveLength(2); // upserts, not duplicates
  });

  it("a rename lands as an update + schema_updates row; a removal stamps first_unseen_run", async () => {
    await syncOnce(RUN_A, CAPTURED);
    const renamed: CapturedBase = {
      ...CAPTURED,
      tables: [
        {
          ...CAPTURED.tables[0],
          fields: [{ fieldId: "fldName", name: "Deal Name", type: "singleLineText" }], // fldAmt gone
        },
      ],
    };
    const { baseRunId } = await syncOnce(RUN_B, renamed);

    const ws = await readSchemaWorkingSet(exec, "appBase1");
    expect(ws.fields.find((f) => f.fieldId === "fldName")).toMatchObject({ name: "Deal Name", status: "active" });
    expect(ws.fields.find((f) => f.fieldId === "fldAmt")).toMatchObject({ status: "removed" });

    const removedRow = (await exec.query(
      `SELECT first_unseen_run FROM bo_at_fields WHERE field_id = 'fldAmt'`,
    )) as { first_unseen_run: string }[];
    expect(removedRow[0].first_unseen_run).toBe(baseRunId);

    const updates = await exec.query(`SELECT entity_id, change_type FROM bo_at_schema_updates WHERE run_id = ?`, [baseRunId]);
    expect(updates.length).toBeGreaterThan(0);
  });
});

describe("readAllEntities (Browse read)", () => {
  it("returns the pg-shaped payload incl. field config + removedAt", async () => {
    await syncOnce(RUN_A, CAPTURED);
    const removed: CapturedBase = { ...CAPTURED, tables: [{ ...CAPTURED.tables[0], fields: [CAPTURED.tables[0].fields[0]] }] };
    const { baseRunId } = await syncOnce(RUN_B, removed);
    await exec.query(`UPDATE bo_at_base_runs SET completed_at = ? WHERE id = ?`, ["2026-08-25T12:00:00.000Z", baseRunId]);

    const all = await readAllEntities(exec);
    expect(all.bases[0]).toMatchObject({ baseId: "appBase1", name: "CRM", removedAt: null });
    expect(all.tables[0]).toMatchObject({ tableId: "tblDeals", baseId: "appBase1" });
    const amt = all.fields.find((f) => f.fieldId === "fldAmt")!;
    expect(amt.status).toBe("removed");
    expect(amt.removedAt).toBe("2026-08-25T12:00:00.000Z");
    // extractFieldConfig enrichment keys exist on every field row
    expect(all.fields[0]).toHaveProperty("linkedTableId");
    expect(all.views[0]).toMatchObject({ viewId: "viwAll", type: "grid" });
  });
});

describe("regenerateQueryViews on real D1", () => {
  it("builds a queryable live-pivot view over EAV cells and drops stale views", async () => {
    await syncOnce(RUN_A, CAPTURED);
    await exec.query(
      `INSERT INTO bo_at_records (record_id, table_id, base_id, status, created_time) VALUES ('rec1','tblDeals','appBase1','active','2026-01-01T00:00:00Z')`,
    );
    await exec.batch([
      { sql: `INSERT INTO bo_at_record_field_data (record_id, field_id, table_id, value) VALUES ('rec1','fldName','tblDeals','"Acme"')` },
      { sql: `INSERT INTO bo_at_record_field_data (record_id, field_id, table_id, value) VALUES ('rec1','fldAmt','tblDeals','42.5')` },
    ]);
    await exec.query(`CREATE VIEW "stale_old_table" AS SELECT 1 AS one`);

    const res = await regenerateQueryViews(exec, {});
    expect(res.regenerated).toBe(1);
    expect(res.dropped).toBe(1);

    const rows = (await exec.query(`SELECT * FROM "deals"`)) as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ record_id: "rec1", name: "Acme", amount: 42.5 });

    const staleLeft = await exec.query(`SELECT name FROM sqlite_master WHERE type='view' AND name='stale_old_table'`);
    expect(staleLeft).toHaveLength(0);
  });
});
