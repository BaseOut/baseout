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
import type { InterfaceDiffResult, PriorInterfaceWorkingSet } from "./interfaces-sync";
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
// server-interfaces-normalize. MCP diffing reads/writes ONLY submitted_via='mcp'
// entity rows — manually-submitted rows for the same airtable_entity_id are
// parallel and never touched (change spec "manual rows are never touched"). The
// six normalized tables: entity tables (interfaces/pages/forms) have no unique
// (base_id, airtable_entity_id) index yet (deferred to the manual-crud change),
// so entity writes target the row ids carried on the diff ops. Link tables
// (page_tables/page_fields) DO have a natural unique index, so they upsert by
// key; they carry no submitted_via (MCP-only today) and are scoped by base_id.
// bo_at_form_fields is never written here (empty until get_form_schema exists).

export async function readInterfaceWorkingSet(
  tx: SpaceTx,
  baseId: string,
): Promise<PriorInterfaceWorkingSet> {
  const interfaces = await tx
    .select({
      id: spacePg.interfaces.id,
      airtableEntityId: spacePg.interfaces.airtableEntityId,
      name: spacePg.interfaces.name,
      definition: spacePg.interfaces.definition,
      status: spacePg.interfaces.status,
    })
    .from(spacePg.interfaces)
    .where(and(eq(spacePg.interfaces.baseId, baseId), eq(spacePg.interfaces.submittedVia, "mcp")));

  const pages = await tx
    .select({
      id: spacePg.pages.id,
      airtableEntityId: spacePg.pages.airtableEntityId,
      interfaceId: spacePg.pages.interfaceId,
      name: spacePg.pages.name,
      pageType: spacePg.pages.pageType,
      sourceTableId: spacePg.pages.sourceTableId,
      definition: spacePg.pages.definition,
      status: spacePg.pages.status,
    })
    .from(spacePg.pages)
    .where(and(eq(spacePg.pages.baseId, baseId), eq(spacePg.pages.submittedVia, "mcp")));

  const forms = await tx
    .select({
      id: spacePg.forms.id,
      airtableEntityId: spacePg.forms.airtableEntityId,
      interfaceId: spacePg.forms.interfaceId,
      name: spacePg.forms.name,
      sourceTableId: spacePg.forms.sourceTableId,
      definition: spacePg.forms.definition,
      status: spacePg.forms.status,
    })
    .from(spacePg.forms)
    .where(and(eq(spacePg.forms.baseId, baseId), eq(spacePg.forms.submittedVia, "mcp")));

  const pageTables = await tx
    .select({
      pageId: spacePg.pageTables.pageId,
      tableId: spacePg.pageTables.tableId,
      status: spacePg.pageTables.status,
    })
    .from(spacePg.pageTables)
    .where(eq(spacePg.pageTables.baseId, baseId));

  const pageFields = await tx
    .select({
      pageId: spacePg.pageFields.pageId,
      tableId: spacePg.pageFields.tableId,
      fieldId: spacePg.pageFields.fieldId,
      isEditable: spacePg.pageFields.isEditable,
      status: spacePg.pageFields.status,
    })
    .from(spacePg.pageFields)
    .where(eq(spacePg.pageFields.baseId, baseId));

  return { interfaces, pages, forms, pageTables, pageFields };
}

export async function applyInterfaceDiff(
  tx: SpaceTx,
  args: { baseId: string; baseRunId: string; diff: InterfaceDiffResult },
): Promise<void> {
  const { baseId, baseRunId: runId, diff } = args;

  if (diff.unchanged) {
    // Identical capture: the hash short-circuits diffing but freshness is still
    // stamped on every active row across the five tracked tables (form_fields
    // is always empty). change spec: "still stamping last_seen_run".
    for (const table of [spacePg.interfaces, spacePg.pages, spacePg.forms] as const) {
      await tx
        .update(table)
        .set({ lastSeenRun: runId })
        .where(and(eq(table.baseId, baseId), eq(table.submittedVia, "mcp"), eq(table.status, "active")));
    }
    for (const table of [spacePg.pageTables, spacePg.pageFields] as const) {
      await tx
        .update(table)
        .set({ lastSeenRun: runId })
        .where(and(eq(table.baseId, baseId), eq(table.status, "active")));
    }
    return;
  }

  // ── entity tables: insert / seen-refresh / remove (targeted by row id) ──
  if (diff.interfaces.inserts.length) {
    await tx.insert(spacePg.interfaces).values(
      diff.interfaces.inserts.map((e) => ({
        baseId,
        airtableEntityId: e.airtableEntityId,
        name: e.name,
        definition: e.definition,
        status: "active",
        submittedVia: "mcp",
        firstSeenRun: runId,
        lastSeenRun: runId,
      })),
    );
  }
  for (const { rowId, entity } of diff.interfaces.seen) {
    await tx
      .update(spacePg.interfaces)
      .set({ name: entity.name, definition: entity.definition, status: "active", lastSeenRun: runId })
      .where(eq(spacePg.interfaces.id, rowId));
  }
  for (const { rowId } of diff.interfaces.removals) {
    await tx
      .update(spacePg.interfaces)
      .set({ status: "removed", firstUnseenRun: sql`coalesce(${spacePg.interfaces.firstUnseenRun}, ${runId})` })
      .where(eq(spacePg.interfaces.id, rowId));
  }

  if (diff.pages.inserts.length) {
    await tx.insert(spacePg.pages).values(
      diff.pages.inserts.map((e) => ({
        baseId,
        airtableEntityId: e.airtableEntityId,
        interfaceId: e.interfaceId,
        name: e.name,
        pageType: e.pageType,
        sourceTableId: e.sourceTableId,
        definition: e.definition,
        status: "active",
        submittedVia: "mcp",
        firstSeenRun: runId,
        lastSeenRun: runId,
      })),
    );
  }
  for (const { rowId, entity } of diff.pages.seen) {
    await tx
      .update(spacePg.pages)
      .set({
        interfaceId: entity.interfaceId,
        name: entity.name,
        pageType: entity.pageType,
        sourceTableId: entity.sourceTableId,
        definition: entity.definition,
        status: "active",
        lastSeenRun: runId,
      })
      .where(eq(spacePg.pages.id, rowId));
  }
  for (const { rowId } of diff.pages.removals) {
    await tx
      .update(spacePg.pages)
      .set({ status: "removed", firstUnseenRun: sql`coalesce(${spacePg.pages.firstUnseenRun}, ${runId})` })
      .where(eq(spacePg.pages.id, rowId));
  }

  if (diff.forms.inserts.length) {
    await tx.insert(spacePg.forms).values(
      diff.forms.inserts.map((e) => ({
        baseId,
        airtableEntityId: e.airtableEntityId,
        interfaceId: e.interfaceId,
        name: e.name,
        sourceTableId: e.sourceTableId,
        definition: e.definition,
        status: "active",
        submittedVia: "mcp",
        firstSeenRun: runId,
        lastSeenRun: runId,
      })),
    );
  }
  for (const { rowId, entity } of diff.forms.seen) {
    await tx
      .update(spacePg.forms)
      .set({
        interfaceId: entity.interfaceId,
        name: entity.name,
        sourceTableId: entity.sourceTableId,
        definition: entity.definition,
        status: "active",
        lastSeenRun: runId,
      })
      .where(eq(spacePg.forms.id, rowId));
  }
  for (const { rowId } of diff.forms.removals) {
    await tx
      .update(spacePg.forms)
      .set({ status: "removed", firstUnseenRun: sql`coalesce(${spacePg.forms.firstUnseenRun}, ${runId})` })
      .where(eq(spacePg.forms.id, rowId));
  }

  // ── link tables: upsert-by-natural-key / remove-by-natural-key ──
  for (const l of diff.pageTables.upserts) {
    await tx
      .insert(spacePg.pageTables)
      .values({ baseId, pageId: l.pageId, tableId: l.tableId, status: "active", firstSeenRun: runId, lastSeenRun: runId })
      .onConflictDoUpdate({
        target: [spacePg.pageTables.pageId, spacePg.pageTables.tableId],
        set: { status: "active", lastSeenRun: runId },
      });
  }
  for (const k of diff.pageTables.removals) {
    await tx
      .update(spacePg.pageTables)
      .set({ status: "removed", firstUnseenRun: sql`coalesce(${spacePg.pageTables.firstUnseenRun}, ${runId})` })
      .where(and(eq(spacePg.pageTables.pageId, k.pageId), eq(spacePg.pageTables.tableId, k.tableId)));
  }

  for (const l of diff.pageFields.upserts) {
    await tx
      .insert(spacePg.pageFields)
      .values({
        baseId,
        pageId: l.pageId,
        tableId: l.tableId,
        fieldId: l.fieldId,
        isEditable: l.isEditable,
        status: "active",
        firstSeenRun: runId,
        lastSeenRun: runId,
      })
      .onConflictDoUpdate({
        target: [spacePg.pageFields.pageId, spacePg.pageFields.fieldId],
        set: { tableId: l.tableId, isEditable: l.isEditable, status: "active", lastSeenRun: runId },
      });
  }
  for (const k of diff.pageFields.removals) {
    await tx
      .update(spacePg.pageFields)
      .set({ status: "removed", firstUnseenRun: sql`coalesce(${spacePg.pageFields.firstUnseenRun}, ${runId})` })
      .where(and(eq(spacePg.pageFields.pageId, k.pageId), eq(spacePg.pageFields.fieldId, k.fieldId)));
  }

  // ── changelog rows (entity_type widened to interface|page|form) ──
  if (diff.updates.length) {
    await tx.insert(spacePg.schemaUpdates).values(
      diff.updates.map((u) => ({
        runId,
        entityType: u.entityType,
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
