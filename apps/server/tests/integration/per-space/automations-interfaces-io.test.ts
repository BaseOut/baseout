// Real-PG tests for automations-interfaces-io (server-automations-interfaces-manual-crud).
// Gated behind RUN_DB_TESTS=1 — the engine vitest pool has no provisioned Space DB
// by default. To run:
//   RUN_DB_TESTS=1 DATABASE_URL=postgres://… pnpm --filter @baseout/server test \
//     tests/integration/per-space/automations-interfaces-io.test.ts

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { spacePgDdlStatements } from "@baseout/db-schema/space/pg-ddl";
import { spacePg } from "@baseout/db-schema/space";
import {
  createAutomation,
  createInterface,
  listAutomations,
  listInterfaces,
  removeAutomation,
  updateAutomation,
  updateInterface,
} from "../../../src/lib/per-space/automations-interfaces-io";

const skip = process.env.RUN_DB_TESTS !== "1";
const SCHEMA = `bo_test_ai_${Date.now().toString(36)}`;

describe.skipIf(skip)("automations-interfaces-io (real PG)", () => {
  let client: ReturnType<typeof postgres>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;

  async function withTx<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return db.transaction(async (tx: any) => {
      await tx.execute(sql.raw(`SET LOCAL search_path TO "${SCHEMA}", public`));
      return fn(tx);
    });
  }

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL required when RUN_DB_TESTS=1");
    client = postgres(url, { prepare: false, max: 1, connect_timeout: 5 });
    try {
      await client`SELECT 1`;
    } catch {
      await client.end({ timeout: 1 }).catch(() => {});
      // Soft-skip when the configured URL is unreachable (VPN / remote-only).
      return;
    }
    db = drizzle(client);
    await client.unsafe(`CREATE SCHEMA "${SCHEMA}"`);
    await client.unsafe(`SET search_path TO "${SCHEMA}", public`);
    for (const stmt of spacePgDdlStatements()) {
      await client.unsafe(stmt);
    }
    // Seed one active table + field so targetRemoved flags are meaningful.
    await withTx(async (tx) => {
      await tx.insert(spacePg.bases).values({
        baseId: "appX",
        name: "Test",
        status: "active",
      });
      await tx.insert(spacePg.tables).values({
        tableId: "tblA",
        baseId: "appX",
        name: "Projects",
        status: "active",
      });
      await tx.insert(spacePg.fields).values({
        fieldId: "fldA",
        tableId: "tblA",
        baseId: "appX",
        name: "Name",
        type: "singleLineText",
        status: "active",
      });
      await tx.insert(spacePg.tables).values({
        tableId: "tblGone",
        baseId: "appX",
        name: "Archive",
        status: "removed",
      });
    });
  }, 60_000);

  afterAll(async () => {
    if (!client) return;
    try {
      if (db) await client.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    } finally {
      await client.end({ timeout: 5 }).catch(() => {});
    }
  });

  it("creates an automation with manual tags and lists it", async () => {
    if (!db) return;
    const created = await withTx((tx) =>
      createAutomation(tx, {
        baseId: "appX",
        airtableEntityId: "autN1",
        name: "On create",
        type: "whenRecordCreated",
        tags: [
          { targetType: "table", targetId: "tblA" },
          { targetType: "field", targetId: "fldA" },
        ],
      }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.entity.submittedVia).toBe("manual_form");
    expect(created.entity.status).toBe("active");
    expect(created.entity.tags).toHaveLength(2);
    expect(created.entity.tags.every((t) => t.source === "manual")).toBe(true);
    expect(created.entity.tags.every((t) => t.targetRemoved === false)).toBe(true);

    const listed = await withTx((tx) => listAutomations(tx, { baseId: "appX" }));
    expect(listed.some((a) => a.id === created.entity.id)).toBe(true);
  });

  it("returns duplicate_entity on a second create with the same airtable_entity_id", async () => {
    if (!db) return;
    const again = await withTx((tx) =>
      createAutomation(tx, {
        baseId: "appX",
        airtableEntityId: "autN1",
        name: "Dup",
      }),
    );
    expect(again).toEqual({ ok: false, code: "duplicate_entity" });
  });

  it("update replaces manual tags only — seeded auto tags survive", async () => {
    if (!db) return;
    const created = await withTx((tx) =>
      createAutomation(tx, {
        baseId: "appX",
        airtableEntityId: "autN2",
        name: "Tagged",
        tags: [{ targetType: "table", targetId: "tblA" }],
      }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Seed an auto tag directly.
    await withTx(async (tx) => {
      await tx.insert(spacePg.entityTags).values({
        entityKind: "automation",
        entityId: created.entity.id,
        targetType: "field",
        targetId: "fldA",
        source: "auto",
        addedAt: new Date(),
      });
    });

    const updated = await withTx((tx) =>
      updateAutomation(tx, {
        id: created.entity.id,
        tags: [{ targetType: "table", targetId: "tblGone" }],
      }),
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    const sources = updated.entity.tags.map((t) => t.source).sort();
    expect(sources).toEqual(["auto", "manual"]);
    const manual = updated.entity.tags.find((t) => t.source === "manual")!;
    expect(manual.targetId).toBe("tblGone");
    expect(manual.targetRemoved).toBe(true);
    const auto = updated.entity.tags.find((t) => t.source === "auto")!;
    expect(auto.targetId).toBe("fldA");
  });

  it("soft-removes an automation (hidden without includeRemoved)", async () => {
    if (!db) return;
    const created = await withTx((tx) =>
      createAutomation(tx, { baseId: "appX", airtableEntityId: "autN3", name: "Gone" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const removed = await withTx((tx) => removeAutomation(tx, created.entity.id));
    expect(removed).toEqual({ ok: true });

    const active = await withTx((tx) => listAutomations(tx, { baseId: "appX" }));
    expect(active.some((a) => a.id === created.entity.id)).toBe(false);

    const all = await withTx((tx) => listAutomations(tx, { baseId: "appX", includeRemoved: true }));
    const row = all.find((a) => a.id === created.entity.id)!;
    expect(row.status).toBe("removed");
  });

  it("creates an interface app + nested page; page without parent → invalid_parent", async () => {
    if (!db) return;
    const app = await withTx((tx) =>
      createInterface(tx, {
        baseId: "appX",
        airtableEntityId: "pbdApp1",
        name: "CRM App",
        type: "interface",
      }),
    );
    expect(app.ok).toBe(true);
    if (!app.ok) return;

    const orphan = await withTx((tx) =>
      createInterface(tx, {
        baseId: "appX",
        airtableEntityId: "pagOrphan",
        name: "Orphan",
        type: "page",
      }),
    );
    expect(orphan).toEqual({ ok: false, code: "invalid_parent" });

    const page = await withTx((tx) =>
      createInterface(tx, {
        baseId: "appX",
        airtableEntityId: "pag1",
        name: "Overview",
        type: "page",
        parentId: "pbdApp1",
        tags: [{ targetType: "table", targetId: "tblA" }],
      }),
    );
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.entity.type).toBe("page");
    expect(page.entity.parentId).toBe("pbdApp1");
    expect(page.entity.tags).toHaveLength(1);

    const listed = await withTx((tx) => listInterfaces(tx, { baseId: "appX" }));
    expect(listed.some((i) => i.id === app.entity.id && i.type === "interface")).toBe(true);
    expect(listed.some((i) => i.id === page.entity.id && i.parentId === "pbdApp1")).toBe(true);
  });

  it("updateInterface rejects an invalid parentId for a page", async () => {
    if (!db) return;
    const app = await withTx((tx) =>
      createInterface(tx, {
        baseId: "appX",
        airtableEntityId: "pbdApp2",
        name: "App2",
        type: "interface",
      }),
    );
    expect(app.ok).toBe(true);
    if (!app.ok) return;
    const page = await withTx((tx) =>
      createInterface(tx, {
        baseId: "appX",
        airtableEntityId: "pag2",
        name: "P2",
        type: "page",
        parentId: "pbdApp2",
      }),
    );
    expect(page.ok).toBe(true);
    if (!page.ok) return;

    const bad = await withTx((tx) =>
      updateInterface(tx, { id: page.entity.id, parentId: "pbdMissing" }),
    );
    expect(bad).toEqual({ ok: false, code: "invalid_parent" });
  });
});
