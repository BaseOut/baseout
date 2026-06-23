// Per-Space DB read + apply — Postgres backend (managed_pg + byodb), I/O layer.
//
// Reuses the shared `spacePg` Drizzle tables (@baseout/db-schema/space) over a
// dedicated connection whose search_path points at the Space's schema, so the
// unqualified bo_at_* tables resolve into bo_space_<id>. The pure diff modules
// (schema-diff / record-diff) decide WHAT changes; this module applies the ops.
//
// Per CLAUDE.md §5.1: per-request connection, torn down with ctx.waitUntil.

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { and, eq, sql } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { LifecycleOp, PriorWorkingSet, SchemaDiffResult } from "./schema-diff";
import type { PriorCell, PriorRecord, RecordDiffResult } from "./record-diff";

export type SpacePgDb = PostgresJsDatabase<Record<string, never>>;

/** Open a per-Space Postgres connection (search_path → the Space's schema). */
export function createSpacePgDb(
  connectionUrl: string,
  schemaName: string,
): { db: SpacePgDb; sql: Sql } {
  const client = postgres(connectionUrl, {
    prepare: false,
    max: 1,
    connection: { search_path: `${schemaName}, public` },
  });
  return { db: drizzle(client), sql: client };
}

const tsOrNull = (iso: string | null): Date | null => (iso ? new Date(iso) : null);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ───────────────────────── base_runs ─────────────────────────

/** Select-or-insert the per-(backup_run, base) execution row; returns its id. */
export async function ensureBaseRun(
  db: SpacePgDb,
  backupRunId: string,
  baseId: string,
): Promise<string> {
  const existing = await db
    .select({ id: spacePg.baseRuns.id })
    .from(spacePg.baseRuns)
    .where(
      and(
        eq(spacePg.baseRuns.backupRunId, backupRunId),
        eq(spacePg.baseRuns.baseId, baseId),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db
    .insert(spacePg.baseRuns)
    .values({ backupRunId, baseId, status: "running", startedAt: new Date() })
    .returning({ id: spacePg.baseRuns.id });
  return row!.id;
}

// ───────────────────────── schema ─────────────────────────

export async function readSchemaWorkingSet(
  db: SpacePgDb,
  baseId: string,
): Promise<PriorWorkingSet> {
  const [bases, tables, fields, views] = await Promise.all([
    db.select().from(spacePg.bases).where(eq(spacePg.bases.baseId, baseId)),
    db.select().from(spacePg.tables).where(eq(spacePg.tables.baseId, baseId)),
    db.select().from(spacePg.fields).where(eq(spacePg.fields.baseId, baseId)),
    db.select().from(spacePg.views).where(eq(spacePg.views.baseId, baseId)),
  ]);
  const b = bases[0];
  return {
    base: b ? { baseId: b.baseId, name: b.name, description: b.description, status: b.status } : null,
    tables: tables.map((t) => ({
      tableId: t.tableId,
      name: t.name,
      primaryFieldId: t.primaryFieldId,
      description: t.description,
      status: t.status,
    })),
    fields: fields.map((f) => ({
      fieldId: f.fieldId,
      tableId: f.tableId,
      name: f.name,
      type: f.type,
      options: f.options,
      isPrimary: f.isPrimary,
      description: f.description,
      status: f.status,
    })),
    views: views.map((v) => ({
      viewId: v.viewId,
      tableId: v.tableId,
      name: v.name,
      type: v.type,
      status: v.status,
    })),
  };
}

async function applyLifecycleOp(
  db: SpacePgDb,
  runId: string,
  op: LifecycleOp,
): Promise<void> {
  const a = op.attrs;
  const str = (v: unknown) => v as string;
  const nstr = (v: unknown) => (v as string | null) ?? null;

  if (op.action === "insert" || op.action === "seen") {
    switch (op.entity) {
      case "base":
        await db
          .insert(spacePg.bases)
          .values({ baseId: op.id, name: str(a.name), description: nstr(a.description), status: "active", firstSeenRun: runId, lastSeenRun: runId })
          .onConflictDoUpdate({ target: spacePg.bases.baseId, set: { name: str(a.name), description: nstr(a.description), status: "active", lastSeenRun: runId } });
        return;
      case "table":
        await db
          .insert(spacePg.tables)
          .values({ tableId: op.id, baseId: op.baseId, name: str(a.name), primaryFieldId: nstr(a.primaryFieldId), fieldCount: (a.fieldCount as number | null) ?? null, recordCount: (a.recordCount as number | null) ?? null, description: nstr(a.description), status: "active", firstSeenRun: runId, lastSeenRun: runId })
          .onConflictDoUpdate({ target: spacePg.tables.tableId, set: { name: str(a.name), primaryFieldId: nstr(a.primaryFieldId), fieldCount: (a.fieldCount as number | null) ?? null, recordCount: (a.recordCount as number | null) ?? null, description: nstr(a.description), status: "active", lastSeenRun: runId } });
        return;
      case "field":
        await db
          .insert(spacePg.fields)
          .values({ fieldId: op.id, tableId: str(op.tableId), baseId: op.baseId, name: str(a.name), type: str(a.type), options: a.options ?? null, isPrimary: (a.isPrimary as boolean) ?? false, description: nstr(a.description), status: "active", firstSeenRun: runId, lastSeenRun: runId })
          .onConflictDoUpdate({ target: spacePg.fields.fieldId, set: { name: str(a.name), type: str(a.type), options: a.options ?? null, isPrimary: (a.isPrimary as boolean) ?? false, description: nstr(a.description), status: "active", lastSeenRun: runId } });
        return;
      case "view":
        await db
          .insert(spacePg.views)
          .values({ viewId: op.id, tableId: str(op.tableId), baseId: op.baseId, name: str(a.name), type: nstr(a.type), status: "active", firstSeenRun: runId, lastSeenRun: runId })
          .onConflictDoUpdate({ target: spacePg.views.viewId, set: { name: str(a.name), type: nstr(a.type), status: "active", lastSeenRun: runId } });
        return;
    }
  }

  // removed | unknown
  const status = op.action;
  switch (op.entity) {
    case "base":
      await db.update(spacePg.bases).set(status === "removed" ? { status, firstUnseenRun: sql`coalesce(${spacePg.bases.firstUnseenRun}, ${runId})` } : { status }).where(eq(spacePg.bases.baseId, op.id));
      return;
    case "table":
      await db.update(spacePg.tables).set(status === "removed" ? { status, firstUnseenRun: sql`coalesce(${spacePg.tables.firstUnseenRun}, ${runId})` } : { status }).where(eq(spacePg.tables.tableId, op.id));
      return;
    case "field":
      await db.update(spacePg.fields).set(status === "removed" ? { status, firstUnseenRun: sql`coalesce(${spacePg.fields.firstUnseenRun}, ${runId})` } : { status }).where(eq(spacePg.fields.fieldId, op.id));
      return;
    case "view":
      await db.update(spacePg.views).set(status === "removed" ? { status, firstUnseenRun: sql`coalesce(${spacePg.views.firstUnseenRun}, ${runId})` } : { status }).where(eq(spacePg.views.viewId, op.id));
      return;
  }
}

export async function applySchemaDiff(
  db: SpacePgDb,
  args: { baseId: string; baseRunId: string; result: SchemaDiffResult; schemaJson: unknown },
): Promise<{ schemaVersionId: string | null }> {
  const { baseId, baseRunId, result, schemaJson } = args;

  // 1. Version row, hash-deduped (insert only when the hash is new).
  if (result.schemaChanged) {
    await db
      .insert(spacePg.schemaVersions)
      .values({ baseId, schemaHash: result.schemaHash, schemaJson, firstSeenRun: baseRunId })
      .onConflictDoNothing();
  }
  const [ver] = await db
    .select({ id: spacePg.schemaVersions.id })
    .from(spacePg.schemaVersions)
    .where(and(eq(spacePg.schemaVersions.baseId, baseId), eq(spacePg.schemaVersions.schemaHash, result.schemaHash)))
    .limit(1);
  const schemaVersionId = ver?.id ?? null;

  await db
    .update(spacePg.baseRuns)
    .set({ schemaVersionId, schemaHash: result.schemaHash })
    .where(eq(spacePg.baseRuns.id, baseRunId));

  // 2. Lifecycle (low volume — per-base entities; per-row is fine).
  for (const op of result.lifecycle) await applyLifecycleOp(db, baseRunId, op);

  // 3. Modifications.
  if (result.schemaUpdates.length) {
    await db.insert(spacePg.schemaUpdates).values(
      result.schemaUpdates.map((u) => ({
        runId: baseRunId,
        entityType: u.entityType,
        entityId: u.entityId,
        baseId: u.baseId,
        tableId: u.tableId,
        changeType: u.changeType,
        changeTypeName: u.changeTypeName,
        beforeValue: u.beforeValue,
        afterValue: u.afterValue,
        breaksData: u.breaksData,
      })),
    );
  }

  return { schemaVersionId };
}

// ───────────────────────── records (EAV) ─────────────────────────

export async function readRecordWorkingSet(
  db: SpacePgDb,
  tableId: string,
): Promise<{ priorRecords: PriorRecord[]; priorCells: PriorCell[] }> {
  const [records, cells] = await Promise.all([
    db.select({ recordId: spacePg.records.recordId, status: spacePg.records.status }).from(spacePg.records).where(eq(spacePg.records.tableId, tableId)),
    db.select({ recordId: spacePg.recordFieldData.recordId, fieldId: spacePg.recordFieldData.fieldId, value: spacePg.recordFieldData.value }).from(spacePg.recordFieldData).where(eq(spacePg.recordFieldData.tableId, tableId)),
  ]);
  return { priorRecords: records, priorCells: cells };
}

const CHUNK = 500;

export async function applyRecordDiff(
  db: SpacePgDb,
  args: { tableId: string; baseId: string; baseRunId: string; result: RecordDiffResult },
): Promise<void> {
  const { tableId, baseId, baseRunId: runId, result } = args;

  // Records: batch the active upserts; loop the (few) deleted/unknown.
  const upserts = result.records.filter((r) => r.action === "insert" || r.action === "seen");
  for (const rows of chunk(upserts, CHUNK)) {
    await db
      .insert(spacePg.records)
      .values(rows.map((r) => ({ recordId: r.recordId, tableId, baseId, createdTime: tsOrNull(r.createdTime), modifiedTime: tsOrNull(r.modifiedTime), status: "active", firstSeenRun: runId, lastSeenRun: runId })))
      .onConflictDoUpdate({ target: spacePg.records.recordId, set: { status: "active", modifiedTime: sql`excluded.modified_time`, lastSeenRun: sql`excluded.last_seen_run` } });
  }
  for (const r of result.records) {
    if (r.action === "deleted") {
      await db.update(spacePg.records).set({ status: "deleted", firstUnseenRun: sql`coalesce(${spacePg.records.firstUnseenRun}, ${runId})` }).where(eq(spacePg.records.recordId, r.recordId));
    } else if (r.action === "unknown") {
      await db.update(spacePg.records).set({ status: "unknown" }).where(eq(spacePg.records.recordId, r.recordId));
    }
  }

  // Cells: batch upsert (insert/update/seen all become upsert on (record,field)).
  for (const rows of chunk(result.cells, CHUNK)) {
    await db
      .insert(spacePg.recordFieldData)
      .values(rows.map((c) => ({ recordId: c.recordId, fieldId: c.fieldId, tableId, value: c.value, firstSeenRun: runId, lastSeenRun: runId })))
      .onConflictDoUpdate({ target: [spacePg.recordFieldData.recordId, spacePg.recordFieldData.fieldId], set: { value: sql`excluded.value`, lastSeenRun: sql`excluded.last_seen_run` } });
  }

  // Superseded-value log: append-only.
  for (const rows of chunk(result.recordUpdates, CHUNK)) {
    await db.insert(spacePg.recordUpdates).values(rows.map((u) => ({ recordId: u.recordId, fieldId: u.fieldId, tableId, runId, oldValue: u.oldValue })));
  }
}
