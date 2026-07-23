// Incremental-apply I/O — Postgres backend (managed_pg), thin drizzle appliers.
//
// Server half of the engine-brokered IncrementalDb contract
// (openspec/changes/server-dynamic-mode, re-scoped; consumed by
// apps/workflows/trigger/tasks/incremental-backup.task.ts once its notYetWired
// stubs are connected). Every DECISION lives in the pure module
// incremental-apply.ts — this file only walks a plan inside the caller's
// withSpaceSchema transaction, matching the space-db-pg.ts house pattern.
// Drizzle bodies here are smoke-verified (describe-schema-io precedent).

import { and, eq, inArray, sql } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { SpaceTx } from "./space-db-pg";
import {
  buildAppliedSchemaState,
  decodeStoredCells,
  type AppliedSchemaState,
  type IncrementalCounts,
  type RecordPlan,
  type SchemaPlan,
  type StoredRecordState,
} from "./incremental-apply";

const tsOrNull = (iso: string | null): Date | null => (iso ? new Date(iso) : null);

// ── base runs ────────────────────────────────────────────────────────────────

/**
 * Select-or-insert the per-(backup_run, base) execution row with
 * run_type='incremental'. Idempotent: a task retry replaying open-base-run
 * gets the same baseRunId back.
 */
export async function openIncrementalBaseRun(
  tx: SpaceTx,
  args: { backupRunId: string; baseId: string },
): Promise<{ baseRunId: string }> {
  const existing = await tx
    .select({ id: spacePg.baseRuns.id })
    .from(spacePg.baseRuns)
    .where(
      and(
        eq(spacePg.baseRuns.backupRunId, args.backupRunId),
        eq(spacePg.baseRuns.baseId, args.baseId),
      ),
    )
    .limit(1);
  if (existing[0]) return { baseRunId: existing[0].id };
  const [row] = await tx
    .insert(spacePg.baseRuns)
    .values({
      backupRunId: args.backupRunId,
      baseId: args.baseId,
      status: "running",
      runType: "incremental",
      startedAt: new Date(),
    })
    .returning({ id: spacePg.baseRuns.id });
  return { baseRunId: row!.id };
}

/**
 * Complete the base run. bo_at_base_runs has no per-category count columns, so
 * records_count aggregates every record the pass touched
 * (created + updated + deleted + reconciledRecords) — run-detail granularity
 * comes from the master-DB completion POST, not this row.
 */
export async function completeIncrementalBaseRun(
  tx: SpaceTx,
  args: {
    baseRunId: string;
    status: "succeeded" | "failed";
    counts: IncrementalCounts;
    errorMessage?: string;
  },
): Promise<void> {
  const { created, updated, deleted, reconciledRecords } = args.counts;
  await tx
    .update(spacePg.baseRuns)
    .set({
      status: args.status,
      completedAt: new Date(),
      recordsCount: created + updated + deleted + reconciledRecords,
      errorMessage: args.errorMessage ?? null,
    })
    .where(eq(spacePg.baseRuns.id, args.baseRunId));
}

// ── schema plan ──────────────────────────────────────────────────────────────

export async function applyIncrementalSchemaPlan(
  tx: SpaceTx,
  args: { baseId: string; baseRunId: string; plan: SchemaPlan },
): Promise<{ applied: number; logged: number }> {
  const { baseId, baseRunId: runId, plan } = args;
  let applied = 0;
  let logged = 0;

  for (const op of plan.ops) {
    switch (op.op) {
      case "upsertTable":
        await tx
          .insert(spacePg.tables)
          .values({
            tableId: op.tableId,
            baseId,
            name: op.name,
            description: op.description,
            status: "active",
            firstSeenRun: runId,
            lastSeenRun: runId,
          })
          .onConflictDoUpdate({
            target: spacePg.tables.tableId,
            set: { name: op.name, description: op.description, status: "active", lastSeenRun: runId },
          });
        applied += 1;
        break;

      case "upsertField":
        await tx
          .insert(spacePg.fields)
          .values({
            fieldId: op.fieldId,
            tableId: op.tableId,
            baseId,
            name: op.name,
            type: op.type,
            description: op.description,
            status: "active",
            firstSeenRun: runId,
            lastSeenRun: runId,
          })
          .onConflictDoUpdate({
            target: spacePg.fields.fieldId,
            set: { name: op.name, type: op.type, description: op.description, status: "active", lastSeenRun: runId },
          });
        applied += 1;
        break;

      case "removeTableCascade":
        // Confident removal (explicit destroy event): table + child fields/views
        // → 'removed'; child records → 'deleted'. rfd rows persist (history).
        await tx
          .update(spacePg.tables)
          .set({ status: "removed", firstUnseenRun: sql`coalesce(${spacePg.tables.firstUnseenRun}, ${runId})` })
          .where(eq(spacePg.tables.tableId, op.tableId));
        await tx
          .update(spacePg.fields)
          .set({ status: "removed", firstUnseenRun: sql`coalesce(${spacePg.fields.firstUnseenRun}, ${runId})` })
          .where(eq(spacePg.fields.tableId, op.tableId));
        await tx
          .update(spacePg.views)
          .set({ status: "removed", firstUnseenRun: sql`coalesce(${spacePg.views.firstUnseenRun}, ${runId})` })
          .where(eq(spacePg.views.tableId, op.tableId));
        await tx
          .update(spacePg.records)
          .set({ status: "deleted", firstUnseenRun: sql`coalesce(${spacePg.records.firstUnseenRun}, ${runId})` })
          .where(eq(spacePg.records.tableId, op.tableId));
        applied += 1;
        break;

      case "removeField":
        // rfd rows persist — a removed field's cell history stays anchored.
        await tx
          .update(spacePg.fields)
          .set({ status: "removed", firstUnseenRun: sql`coalesce(${spacePg.fields.firstUnseenRun}, ${runId})` })
          .where(eq(spacePg.fields.fieldId, op.fieldId));
        applied += 1;
        break;

      case "patchTable":
        await tx
          .update(spacePg.tables)
          .set({ ...op.set, lastSeenRun: runId })
          .where(eq(spacePg.tables.tableId, op.tableId));
        applied += 1;
        break;

      case "patchField":
        await tx
          .update(spacePg.fields)
          .set({ ...op.set, lastSeenRun: runId })
          .where(eq(spacePg.fields.fieldId, op.fieldId));
        applied += 1;
        break;

      case "logSchemaUpdate":
        await tx.insert(spacePg.schemaUpdates).values({
          runId,
          entityType: op.row.entityType,
          entityId: op.row.entityId,
          baseId,
          tableId: op.row.tableId,
          changeType: op.row.changeType,
          changeTypeName: null,
          beforeValue: op.row.beforeValue,
          afterValue: op.row.afterValue,
          breaksData: op.row.breaksData,
          actionSource: op.row.actionSource,
          actor: op.row.actor,
        });
        logged += 1;
        break;
    }
  }

  return { applied, logged };
}

// ── record plan ──────────────────────────────────────────────────────────────

export async function applyIncrementalRecordPlan(
  tx: SpaceTx,
  args: { baseId: string; baseRunId: string; plan: RecordPlan },
): Promise<{ applied: number; logged: number }> {
  const { baseId, baseRunId: runId, plan } = args;
  let applied = 0;
  let logged = 0;

  for (const op of plan.ops) {
    switch (op.op) {
      case "upsertRecord": {
        await tx
          .insert(spacePg.records)
          .values({
            recordId: op.recordId,
            tableId: op.tableId,
            baseId,
            createdTime: tsOrNull(op.createdTime),
            status: "active",
            firstSeenRun: runId,
            lastSeenRun: runId,
          })
          .onConflictDoUpdate({
            target: spacePg.records.recordId,
            set: { status: "active", lastSeenRun: runId },
          });
        const cellEntries = Object.entries(op.cells);
        if (cellEntries.length > 0) {
          await tx
            .insert(spacePg.recordFieldData)
            .values(
              cellEntries.map(([fieldId, value]) => ({
                recordId: op.recordId,
                fieldId,
                tableId: op.tableId,
                value,
                firstSeenRun: runId,
                lastSeenRun: runId,
              })),
            )
            .onConflictDoUpdate({
              target: [spacePg.recordFieldData.recordId, spacePg.recordFieldData.fieldId],
              set: { value: sql`excluded.value`, lastSeenRun: sql`excluded.last_seen_run` },
            });
        }
        applied += 1;
        break;
      }

      case "upsertCell":
        await tx
          .insert(spacePg.recordFieldData)
          .values({
            recordId: op.recordId,
            fieldId: op.fieldId,
            tableId: op.tableId,
            value: op.value,
            firstSeenRun: runId,
            lastSeenRun: runId,
          })
          .onConflictDoUpdate({
            target: [spacePg.recordFieldData.recordId, spacePg.recordFieldData.fieldId],
            set: { value: op.value, lastSeenRun: runId },
          });
        await tx
          .update(spacePg.records)
          .set({
            lastSeenRun: runId,
            ...(op.modifiedTime ? { modifiedTime: tsOrNull(op.modifiedTime) } : {}),
          })
          .where(eq(spacePg.records.recordId, op.recordId));
        applied += 1;
        break;

      case "logRecordUpdate":
        await tx.insert(spacePg.recordUpdates).values({
          recordId: op.recordId,
          fieldId: op.fieldId,
          tableId: op.tableId,
          runId,
          oldValue: op.oldValue,
          actionSource: op.actionSource,
          actor: op.actor,
        });
        logged += 1;
        break;

      case "deleteRecord":
        await tx
          .update(spacePg.records)
          .set({ status: "deleted", firstUnseenRun: sql`coalesce(${spacePg.records.firstUnseenRun}, ${runId})` })
          .where(eq(spacePg.records.recordId, op.recordId));
        applied += 1;
        break;
    }
  }

  return { applied, logged };
}

// ── schema versions ──────────────────────────────────────────────────────────

/**
 * Hash-deduped bo_at_schema_versions insert; stamps the base run's
 * schema_version_id + schema_hash either way (mirrors applySchemaDiff).
 */
export async function insertSchemaVersionDeduped(
  tx: SpaceTx,
  args: { baseId: string; baseRunId: string; schemaHash: string; schemaJson: unknown },
): Promise<{ inserted: boolean }> {
  const insertedRows = await tx
    .insert(spacePg.schemaVersions)
    .values({
      baseId: args.baseId,
      schemaHash: args.schemaHash,
      schemaJson: args.schemaJson,
      firstSeenRun: args.baseRunId,
    })
    .onConflictDoNothing()
    .returning({ id: spacePg.schemaVersions.id });

  const [ver] = await tx
    .select({ id: spacePg.schemaVersions.id })
    .from(spacePg.schemaVersions)
    .where(
      and(
        eq(spacePg.schemaVersions.baseId, args.baseId),
        eq(spacePg.schemaVersions.schemaHash, args.schemaHash),
      ),
    )
    .limit(1);

  await tx
    .update(spacePg.baseRuns)
    .set({ schemaVersionId: ver?.id ?? null, schemaHash: args.schemaHash })
    .where(eq(spacePg.baseRuns.id, args.baseRunId));

  return { inserted: insertedRows.length > 0 };
}

// ── read seams ───────────────────────────────────────────────────────────────

/** Stored per-record state for the workflows changed-record diff. */
export async function getStoredRecords(
  tx: SpaceTx,
  tableId: string,
  recordIds: string[],
): Promise<Record<string, StoredRecordState>> {
  if (recordIds.length === 0) return {};
  const recordRows = await tx
    .select({ recordId: spacePg.records.recordId })
    .from(spacePg.records)
    .where(and(eq(spacePg.records.tableId, tableId), inArray(spacePg.records.recordId, recordIds)));
  const cellRows = await tx
    .select({
      recordId: spacePg.recordFieldData.recordId,
      fieldId: spacePg.recordFieldData.fieldId,
      value: spacePg.recordFieldData.value,
    })
    .from(spacePg.recordFieldData)
    .where(
      and(
        eq(spacePg.recordFieldData.tableId, tableId),
        inArray(spacePg.recordFieldData.recordId, recordIds),
      ),
    );
  return decodeStoredCells(recordRows, cellRows);
}

/** Active tables + fields of one base, shaped for the end-of-pass verification. */
export async function getAppliedSchemaState(
  tx: SpaceTx,
  baseId: string,
): Promise<AppliedSchemaState> {
  const tableRows = await tx
    .select({ tableId: spacePg.tables.tableId })
    .from(spacePg.tables)
    .where(and(eq(spacePg.tables.baseId, baseId), eq(spacePg.tables.status, "active")));
  const fieldRows = await tx
    .select({ fieldId: spacePg.fields.fieldId, tableId: spacePg.fields.tableId, type: spacePg.fields.type })
    .from(spacePg.fields)
    .where(and(eq(spacePg.fields.baseId, baseId), eq(spacePg.fields.status, "active")));
  return buildAppliedSchemaState(tableRows, fieldRows);
}

/** Active stored record ids (reconciliation deletion sweep). */
export async function listStoredRecordIds(tx: SpaceTx, tableId: string): Promise<string[]> {
  const rows = await tx
    .select({ recordId: spacePg.records.recordId })
    .from(spacePg.records)
    .where(and(eq(spacePg.records.tableId, tableId), eq(spacePg.records.status, "active")));
  return rows.map((r) => r.recordId);
}

/** Active table ids of one base (reconciliation pass). */
export async function listTableIds(tx: SpaceTx, baseId: string): Promise<string[]> {
  const rows = await tx
    .select({ tableId: spacePg.tables.tableId })
    .from(spacePg.tables)
    .where(and(eq(spacePg.tables.baseId, baseId), eq(spacePg.tables.status, "active")));
  return rows.map((r) => r.tableId);
}
