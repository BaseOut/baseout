// Per-Space DB read + apply — Postgres backend (managed_pg + byodb), I/O layer.
//
// Reuses the shared `spacePg` Drizzle tables (@baseout/db-schema/space). The
// unqualified bo_at_* tables resolve into the Space's schema (bo_space_<id>)
// via a transaction-scoped `SET LOCAL search_path` — NOT a per-connection
// search_path option (Hyperdrive ignores connection startup options, so that
// silently falls back to the role default). All per-Space work runs on the
// master connection inside one transaction (atomic per sync), the same pattern
// provisioning uses. The pure diff modules decide WHAT changes; this applies it.

import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Sql } from "postgres";
import type { AppDb } from "../../db/worker";
import { spacePg } from "@baseout/db-schema/space";
import { schemaNameForSpace } from "../provisioning/posture";
import type { LifecycleOp, PriorWorkingSet, SchemaDiffResult } from "./schema-diff";
import type { InterfaceDiffResult, PriorInterfaceRow } from "./interfaces-sync";
import type { PriorCell, PriorRecord, RecordDiffResult } from "./record-diff";
import { extractFieldConfig, type FieldConfig } from "./schema-enrich";

/** The transaction handle drizzle hands the `db.transaction` callback. */
export type SpaceTx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

/**
 * Run `fn` against the Space's schema on the master connection, inside one
 * transaction whose search_path is set to that schema. `schemaName` is derived
 * from a validated UUID (schemaNameForSpace → [a-z0-9_]) so the raw interpolation
 * is injection-safe.
 */
export async function withSpaceSchema<T>(
  db: AppDb,
  schemaName: string,
  fn: (tx: SpaceTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL search_path TO "${schemaName}", public`));
    return fn(tx);
  });
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
  tx: SpaceTx,
  backupRunId: string,
  baseId: string,
): Promise<string> {
  const existing = await tx
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
  const [row] = await tx
    .insert(spacePg.baseRuns)
    .values({ backupRunId, baseId, status: "running", startedAt: new Date() })
    .returning({ id: spacePg.baseRuns.id });
  return row!.id;
}

// ───────────────────────── schema ─────────────────────────

export async function readSchemaWorkingSet(
  tx: SpaceTx,
  baseId: string,
): Promise<PriorWorkingSet> {
  // Sequential — a postgres-js transaction is one connection (no concurrency).
  const bases = await tx.select().from(spacePg.bases).where(eq(spacePg.bases.baseId, baseId));
  const tables = await tx.select().from(spacePg.tables).where(eq(spacePg.tables.baseId, baseId));
  const fields = await tx.select().from(spacePg.fields).where(eq(spacePg.fields.baseId, baseId));
  const views = await tx.select().from(spacePg.views).where(eq(spacePg.views.baseId, baseId));
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

const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);

/**
 * Read every captured schema entity across all bases — powers the Browse tab's
 * entity tree (Schema Docs, openspec/changes/shared-schema-docs §4). Flat lists;
 * the web view groups bases → tables → fields/views. Read-only broker; the
 * browser never connects to the per-Space DB.
 *
 * Enriched (server-schema-read-enrichment): annotation columns, options-derived
 * field config (extractFieldConfig), and removedAt (first_unseen_run → that base
 * run's completed_at) — all additive to the original payload shape.
 */
export async function readAllEntities(tx: SpaceTx): Promise<{
  bases: { baseId: string; name: string; description: string | null; aiDescription: string | null; descriptionOverride: string | null; status: string; removedAt: string | null }[];
  tables: { tableId: string; baseId: string; name: string; recordCount: number | null; fieldCount: number | null; description: string | null; aiDescription: string | null; descriptionOverride: string | null; status: string; removedAt: string | null }[];
  fields: ({ fieldId: string; tableId: string; baseId: string; name: string; type: string; isPrimary: boolean; description: string | null; aiDescription: string | null; descriptionOverride: string | null; status: string; removedAt: string | null } & FieldConfig)[];
  views: { viewId: string; tableId: string; baseId: string; name: string; type: string | null; status: string; removedAt: string | null }[];
}> {
  const removedRuns = alias(spacePg.baseRuns, "removed_runs");
  const removedAt = isoOrNull;

  const bases = (
    await tx
      .select({ baseId: spacePg.bases.baseId, name: spacePg.bases.name, description: spacePg.bases.description, aiDescription: spacePg.bases.aiDescription, descriptionOverride: spacePg.bases.descriptionOverride, status: spacePg.bases.status, removedAtTs: removedRuns.completedAt })
      .from(spacePg.bases)
      .leftJoin(removedRuns, eq(spacePg.bases.firstUnseenRun, removedRuns.id))
  ).map(({ removedAtTs, ...b }) => ({ ...b, removedAt: removedAt(removedAtTs) }));

  const tables = (
    await tx
      .select({ tableId: spacePg.tables.tableId, baseId: spacePg.tables.baseId, name: spacePg.tables.name, recordCount: spacePg.tables.recordCount, fieldCount: spacePg.tables.fieldCount, description: spacePg.tables.description, aiDescription: spacePg.tables.aiDescription, descriptionOverride: spacePg.tables.descriptionOverride, status: spacePg.tables.status, removedAtTs: removedRuns.completedAt })
      .from(spacePg.tables)
      .leftJoin(removedRuns, eq(spacePg.tables.firstUnseenRun, removedRuns.id))
  ).map(({ removedAtTs, ...t }) => ({ ...t, removedAt: removedAt(removedAtTs) }));

  const fields = (
    await tx
      .select({ fieldId: spacePg.fields.fieldId, tableId: spacePg.fields.tableId, baseId: spacePg.fields.baseId, name: spacePg.fields.name, type: spacePg.fields.type, options: spacePg.fields.options, isPrimary: spacePg.fields.isPrimary, description: spacePg.fields.description, aiDescription: spacePg.fields.aiDescription, descriptionOverride: spacePg.fields.descriptionOverride, status: spacePg.fields.status, removedAtTs: removedRuns.completedAt })
      .from(spacePg.fields)
      .leftJoin(removedRuns, eq(spacePg.fields.firstUnseenRun, removedRuns.id))
  ).map(({ removedAtTs, options, ...f }) => ({
    ...f,
    ...extractFieldConfig(f.type, options),
    removedAt: removedAt(removedAtTs),
  }));

  const views = (
    await tx
      .select({ viewId: spacePg.views.viewId, tableId: spacePg.views.tableId, baseId: spacePg.views.baseId, name: spacePg.views.name, type: spacePg.views.type, status: spacePg.views.status, removedAtTs: removedRuns.completedAt })
      .from(spacePg.views)
      .leftJoin(removedRuns, eq(spacePg.views.firstUnseenRun, removedRuns.id))
  ).map(({ removedAtTs, ...v }) => ({ ...v, removedAt: removedAt(removedAtTs) }));

  return { bases, tables, fields, views };
}

async function applyLifecycleOp(
  tx: SpaceTx,
  runId: string,
  op: LifecycleOp,
): Promise<void> {
  const a = op.attrs;
  const str = (v: unknown) => v as string;
  const nstr = (v: unknown) => (v as string | null) ?? null;

  if (op.action === "insert" || op.action === "seen") {
    switch (op.entity) {
      case "base":
        await tx
          .insert(spacePg.bases)
          .values({ baseId: op.id, name: str(a.name), description: nstr(a.description), status: "active", firstSeenRun: runId, lastSeenRun: runId })
          .onConflictDoUpdate({ target: spacePg.bases.baseId, set: { name: str(a.name), description: nstr(a.description), status: "active", lastSeenRun: runId } });
        return;
      case "table":
        await tx
          .insert(spacePg.tables)
          .values({ tableId: op.id, baseId: op.baseId, name: str(a.name), primaryFieldId: nstr(a.primaryFieldId), fieldCount: (a.fieldCount as number | null) ?? null, recordCount: (a.recordCount as number | null) ?? null, description: nstr(a.description), status: "active", firstSeenRun: runId, lastSeenRun: runId })
          .onConflictDoUpdate({ target: spacePg.tables.tableId, set: { name: str(a.name), primaryFieldId: nstr(a.primaryFieldId), fieldCount: (a.fieldCount as number | null) ?? null, recordCount: (a.recordCount as number | null) ?? null, description: nstr(a.description), status: "active", lastSeenRun: runId } });
        return;
      case "field":
        await tx
          .insert(spacePg.fields)
          .values({ fieldId: op.id, tableId: str(op.tableId), baseId: op.baseId, name: str(a.name), type: str(a.type), options: a.options ?? null, isPrimary: (a.isPrimary as boolean) ?? false, description: nstr(a.description), status: "active", firstSeenRun: runId, lastSeenRun: runId })
          .onConflictDoUpdate({ target: spacePg.fields.fieldId, set: { name: str(a.name), type: str(a.type), options: a.options ?? null, isPrimary: (a.isPrimary as boolean) ?? false, description: nstr(a.description), status: "active", lastSeenRun: runId } });
        return;
      case "view":
        await tx
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
      await tx.update(spacePg.bases).set(status === "removed" ? { status, firstUnseenRun: sql`coalesce(${spacePg.bases.firstUnseenRun}, ${runId})` } : { status }).where(eq(spacePg.bases.baseId, op.id));
      return;
    case "table":
      await tx.update(spacePg.tables).set(status === "removed" ? { status, firstUnseenRun: sql`coalesce(${spacePg.tables.firstUnseenRun}, ${runId})` } : { status }).where(eq(spacePg.tables.tableId, op.id));
      return;
    case "field":
      await tx.update(spacePg.fields).set(status === "removed" ? { status, firstUnseenRun: sql`coalesce(${spacePg.fields.firstUnseenRun}, ${runId})` } : { status }).where(eq(spacePg.fields.fieldId, op.id));
      return;
    case "view":
      await tx.update(spacePg.views).set(status === "removed" ? { status, firstUnseenRun: sql`coalesce(${spacePg.views.firstUnseenRun}, ${runId})` } : { status }).where(eq(spacePg.views.viewId, op.id));
      return;
  }
}

export async function applySchemaDiff(
  tx: SpaceTx,
  args: { baseId: string; baseRunId: string; result: SchemaDiffResult; schemaJson: unknown },
): Promise<{ schemaVersionId: string | null }> {
  const { baseId, baseRunId, result, schemaJson } = args;

  if (result.schemaChanged) {
    await tx
      .insert(spacePg.schemaVersions)
      .values({ baseId, schemaHash: result.schemaHash, schemaJson, firstSeenRun: baseRunId })
      .onConflictDoNothing();
  }
  const [ver] = await tx
    .select({ id: spacePg.schemaVersions.id })
    .from(spacePg.schemaVersions)
    .where(and(eq(spacePg.schemaVersions.baseId, baseId), eq(spacePg.schemaVersions.schemaHash, result.schemaHash)))
    .limit(1);
  const schemaVersionId = ver?.id ?? null;

  await tx
    .update(spacePg.baseRuns)
    .set({ schemaVersionId, schemaHash: result.schemaHash })
    .where(eq(spacePg.baseRuns.id, baseRunId));

  for (const op of result.lifecycle) await applyLifecycleOp(tx, baseRunId, op);

  if (result.schemaUpdates.length) {
    await tx.insert(spacePg.schemaUpdates).values(
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

// ───────────────────────── interfaces (MCP capture) ─────────────────────────
// server-mcp-interface-pages. MCP diffing reads/writes ONLY submitted_via='mcp'
// rows — manually-submitted rows for the same airtable_entity_id are parallel
// and never touched (change spec "Manual submissions are never clobbered").
// bo_at_interfaces has no unique (base_id, airtable_entity_id) index yet (that
// ships with server-automations-interfaces-manual-crud), so writes target row
// ids carried on the diff ops instead of upserting.

export async function readInterfaceWorkingSet(
  tx: SpaceTx,
  baseId: string,
): Promise<PriorInterfaceRow[]> {
  const rows = await tx
    .select({
      id: spacePg.interfaces.id,
      airtableEntityId: spacePg.interfaces.airtableEntityId,
      name: spacePg.interfaces.name,
      type: spacePg.interfaces.type,
      definition: spacePg.interfaces.definition,
      status: spacePg.interfaces.status,
    })
    .from(spacePg.interfaces)
    .where(and(eq(spacePg.interfaces.baseId, baseId), eq(spacePg.interfaces.submittedVia, "mcp")));
  return rows;
}

export async function applyInterfaceDiff(
  tx: SpaceTx,
  args: { baseId: string; baseRunId: string; capturedAt: Date; diff: InterfaceDiffResult },
): Promise<void> {
  const { baseId, baseRunId, capturedAt, diff } = args;

  if (diff.unchanged) {
    // Identical capture: the hash short-circuits diffing but freshness is
    // still stamped (change spec: "while still stamping last_seen_at").
    await tx
      .update(spacePg.interfaces)
      .set({ lastSeenAt: capturedAt })
      .where(
        and(
          eq(spacePg.interfaces.baseId, baseId),
          eq(spacePg.interfaces.submittedVia, "mcp"),
          eq(spacePg.interfaces.status, "active"),
        ),
      );
    return;
  }

  if (diff.inserts.length) {
    await tx.insert(spacePg.interfaces).values(
      diff.inserts.map((e) => ({
        baseId,
        airtableEntityId: e.airtableEntityId,
        name: e.name,
        type: e.kind,
        definition: e.definition,
        status: "active",
        submittedVia: "mcp",
        firstSeenAt: capturedAt,
        lastSeenAt: capturedAt,
      })),
    );
  }

  for (const { rowId, entity } of diff.seen) {
    await tx
      .update(spacePg.interfaces)
      .set({
        name: entity.name,
        type: entity.kind,
        definition: entity.definition,
        status: "active", // reappearance flips removed → active
        lastSeenAt: capturedAt,
      })
      .where(eq(spacePg.interfaces.id, rowId));
  }

  for (const { rowId } of diff.removals) {
    // No first_unseen_run column here — last_seen_at doubles as the
    // removal-detected timestamp (change spec scenario "Page deleted in
    // Airtable": "marked removed with last_seen_at at this run").
    await tx
      .update(spacePg.interfaces)
      .set({ status: "removed", lastSeenAt: capturedAt })
      .where(eq(spacePg.interfaces.id, rowId));
  }

  if (diff.updates.length) {
    await tx.insert(spacePg.schemaUpdates).values(
      diff.updates.map((u) => ({
        runId: baseRunId,
        entityType: "interface",
        entityId: u.entityId,
        baseId,
        tableId: null,
        changeType: u.changeType,
        changeTypeName: null,
        beforeValue: u.beforeValue,
        afterValue: u.afterValue,
        breaksData: false,
      })),
    );
  }
}

// ───────────────────────── records (EAV) ─────────────────────────

export async function readRecordWorkingSet(
  tx: SpaceTx,
  tableId: string,
): Promise<{ priorRecords: PriorRecord[]; priorCells: PriorCell[] }> {
  const records = await tx.select({ recordId: spacePg.records.recordId, status: spacePg.records.status }).from(spacePg.records).where(eq(spacePg.records.tableId, tableId));
  const cells = await tx.select({ recordId: spacePg.recordFieldData.recordId, fieldId: spacePg.recordFieldData.fieldId, value: spacePg.recordFieldData.value }).from(spacePg.recordFieldData).where(eq(spacePg.recordFieldData.tableId, tableId));
  return { priorRecords: records, priorCells: cells };
}

const CHUNK = 500;

export async function applyRecordDiff(
  tx: SpaceTx,
  args: { tableId: string; baseId: string; baseRunId: string; result: RecordDiffResult },
): Promise<void> {
  const { tableId, baseId, baseRunId: runId, result } = args;

  const upserts = result.records.filter((r) => r.action === "insert" || r.action === "seen");
  for (const rows of chunk(upserts, CHUNK)) {
    await tx
      .insert(spacePg.records)
      .values(rows.map((r) => ({ recordId: r.recordId, tableId, baseId, createdTime: tsOrNull(r.createdTime), modifiedTime: tsOrNull(r.modifiedTime), status: "active", firstSeenRun: runId, lastSeenRun: runId })))
      .onConflictDoUpdate({ target: spacePg.records.recordId, set: { status: "active", modifiedTime: sql`excluded.modified_time`, lastSeenRun: sql`excluded.last_seen_run` } });
  }
  for (const r of result.records) {
    if (r.action === "deleted") {
      await tx.update(spacePg.records).set({ status: "deleted", firstUnseenRun: sql`coalesce(${spacePg.records.firstUnseenRun}, ${runId})` }).where(eq(spacePg.records.recordId, r.recordId));
    } else if (r.action === "unknown") {
      await tx.update(spacePg.records).set({ status: "unknown" }).where(eq(spacePg.records.recordId, r.recordId));
    }
  }

  for (const rows of chunk(result.cells, CHUNK)) {
    await tx
      .insert(spacePg.recordFieldData)
      .values(rows.map((c) => ({ recordId: c.recordId, fieldId: c.fieldId, tableId, value: c.value, firstSeenRun: runId, lastSeenRun: runId })))
      .onConflictDoUpdate({ target: [spacePg.recordFieldData.recordId, spacePg.recordFieldData.fieldId], set: { value: sql`excluded.value`, lastSeenRun: sql`excluded.last_seen_run` } });
  }

  for (const rows of chunk(result.recordUpdates, CHUNK)) {
    await tx.insert(spacePg.recordUpdates).values(rows.map((u) => ({ recordId: u.recordId, fieldId: u.fieldId, tableId, runId, oldValue: u.oldValue })));
  }
}

/** Drop a Space's managed_pg schema (cleanup fan-out on Space deletion). */
export async function dropManagedPgSchema(masterSql: Sql, spaceId: string): Promise<void> {
  const schemaName = schemaNameForSpace(spaceId);
  await masterSql.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
}
