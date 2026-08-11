// Per-Space DB read + apply — Postgres backend (managed_pg + byodb), I/O layer.
//
// Reuses the shared `spacePg` Drizzle tables (@baseout/db-schema/space). The
// unqualified bo_at_* tables resolve into the Space's schema (bo_space_<id>)
// via a transaction-scoped `SET LOCAL search_path` — NOT a per-connection
// search_path option (Hyperdrive ignores connection startup options, so that
// silently falls back to the role default). All per-Space work runs on the
// master connection inside one transaction (atomic per sync), the same pattern
// provisioning uses. The pure diff modules decide WHAT changes; this applies it.

import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Sql } from "postgres";
import type { AppDb } from "../../db/worker";
import { spacePg } from "@baseout/db-schema/space";
import { schemaNameForSpace } from "../provisioning/posture";
import type { LifecycleOp, PriorView, PriorWorkingSet, SchemaDiffResult } from "./schema-diff";
import type { InterfaceDiffResult, PriorInterfaceWorkingSet } from "./interfaces-sync";
import type { ViewsDiffResult } from "./views-sync";
import type { CommentDiffResult, PriorComment } from "./comments-sync";
import type {
  CommentAttachmentDiffResult,
  PriorCommentAttachment,
} from "./comment-attachments-sync";
import type {
  BaseAccessDiffResult,
  IngestResult,
  PriorGrant,
  PriorInviteLink,
} from "./collaborators-sync";
import type { MediaDiffResult, PriorAssetRef } from "./media-sync";
import type { AutomationDiffResult, PriorAutomationWorkingSet } from "./automations-sync";
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

/**
 * Gated-sync unknown-sweep (server-view-capture-override): a sync that ran
 * with view capture CLOSED can no longer observe this base's views, so its
 * still-`active` bo_at_views rows flip to the honest lifecycle state
 * `unknown`. No first_unseen_run stamp — that is reserved for confident
 * removals (see applyLifecycleOp's unknown branch). Idempotent; a later
 * gate-open sync's insert/seen upsert returns reappearing rows to `active`.
 */
export async function markViewsUnknownForBase(tx: SpaceTx, baseId: string): Promise<void> {
  await tx
    .update(spacePg.views)
    .set({ status: "unknown" })
    .where(and(eq(spacePg.views.baseId, baseId), eq(spacePg.views.status, "active")));
}

// ───────────────────────── views (MCP capture) ─────────────────────────
// server-mcp-views: the MCP path reads/writes the SAME bo_at_views rows as the
// REST enterprise path (one table, two sources, no per-row provenance —
// design Decision 1). The pure diff lives in views-sync.ts.

/** The base's bo_at_views rows in the PriorView shape views-sync diffs against. */
export async function readViewWorkingSet(tx: SpaceTx, baseId: string): Promise<PriorView[]> {
  const views = await tx.select().from(spacePg.views).where(eq(spacePg.views.baseId, baseId));
  return views.map((v) => ({
    viewId: v.viewId,
    tableId: v.tableId,
    name: v.name,
    type: v.type,
    status: v.status,
  }));
}

/**
 * Write a views diff: lifecycle ops through the same writer the schema diff
 * uses (byte-identical row semantics to the REST path) + name/type rows into
 * bo_at_schema_updates.
 */
export async function applyViewDiff(
  tx: SpaceTx,
  args: { baseRunId: string; diff: ViewsDiffResult },
): Promise<void> {
  const { baseRunId, diff } = args;
  for (const op of diff.lifecycle) await applyLifecycleOp(tx, baseRunId, op);
  if (diff.schemaUpdates.length) {
    await tx.insert(spacePg.schemaUpdates).values(
      diff.schemaUpdates.map((u) => ({
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
}

/**
 * Identical-capture short-circuit's write half: an unchanged MCP capture still
 * sights every active view — stamp last_seen_run in one UPDATE.
 */
export async function stampViewsSeenForBase(
  tx: SpaceTx,
  baseId: string,
  runId: string,
): Promise<void> {
  await tx
    .update(spacePg.views)
    .set({ lastSeenRun: runId })
    .where(and(eq(spacePg.views.baseId, baseId), eq(spacePg.views.status, "active")));
}

// ───────────────────────── comments (server-comments) ─────────────────────────
// Update-in-place with soft deletion; deletion scope is per `complete` record
// capture (comments-sync.ts owns the pure diff + wire types).

/** Prior rows for the batch's record ids — the diff's whole scope (Decision 3). */
export async function readCommentWorkingSet(
  tx: SpaceTx,
  recordIds: string[],
): Promise<PriorComment[]> {
  if (recordIds.length === 0) return [];
  const rows = await tx
    .select()
    .from(spacePg.comments)
    .where(inArray(spacePg.comments.recordId, recordIds));
  return rows.map((r) => ({
    commentId: r.airtableCommentId,
    recordId: r.recordId,
    text: r.text,
    airtableLastUpdatedAt: r.airtableLastUpdatedAt,
    status: r.status,
  }));
}

/**
 * Write a comment diff: upserts keyed by airtable_comment_id (re-captured
 * deleted ids resurrect to active; last-seen stamps always advance) + soft
 * deletions.
 */
export async function applyCommentBatch(
  tx: SpaceTx,
  args: { baseId: string; baseRunId: string; diff: CommentDiffResult; now?: Date },
): Promise<void> {
  const { baseId, baseRunId, diff } = args;
  const now = args.now ?? new Date();
  for (const u of diff.upserts) {
    await tx
      .insert(spacePg.comments)
      .values({
        airtableCommentId: u.commentId,
        baseId,
        tableId: u.tableId,
        recordId: u.recordId,
        author: u.author ?? null,
        text: u.text,
        airtableCreatedAt: u.airtableCreatedAt,
        airtableLastUpdatedAt: u.airtableLastUpdatedAt,
        raw: u.raw ?? null,
        status: "active",
        firstSeenRun: baseRunId,
        lastSeenRun: baseRunId,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: spacePg.comments.airtableCommentId,
        set: {
          author: u.author ?? null,
          text: u.text,
          airtableCreatedAt: u.airtableCreatedAt,
          airtableLastUpdatedAt: u.airtableLastUpdatedAt,
          raw: u.raw ?? null,
          status: "active",
          lastSeenRun: baseRunId,
          lastSeenAt: now,
        },
      });
  }
  if (diff.deletions.length) {
    await tx
      .update(spacePg.comments)
      .set({ status: "deleted" })
      .where(inArray(spacePg.comments.airtableCommentId, diff.deletions));
  }
}

// ───────────────────── comment attachments (server-comment-attachments) ─────
// Register-first: comments-sync upserts pending rows for attachments found in
// comment payloads; the capture task downloads them while URLs are live
// (comment-attachments-sync.ts owns the pure extract + diff + wire types).

/** Prior rows for the batch's comment ids — the diff's whole scope. */
export async function readCommentAttachmentWorkingSet(
  tx: SpaceTx,
  commentIds: string[],
): Promise<PriorCommentAttachment[]> {
  if (commentIds.length === 0) return [];
  const rows = await tx
    .select({
      commentId: spacePg.commentAttachments.airtableCommentId,
      attachmentId: spacePg.commentAttachments.airtableAttachmentId,
      recordId: spacePg.commentAttachments.recordId,
      uploadStatus: spacePg.commentAttachments.uploadStatus,
      status: spacePg.commentAttachments.status,
    })
    .from(spacePg.commentAttachments)
    .where(inArray(spacePg.commentAttachments.airtableCommentId, commentIds));
  return rows;
}

/**
 * Write a comment-attachment diff: upserts keyed by
 * (airtable_comment_id, airtable_attachment_id). A row already `ready`/`uploaded`
 * keeps its upload_status (never regressed); a resurrected `deleted` row flips
 * back to active + pending so it re-downloads. Deletions are soft (bytes kept).
 */
export async function applyCommentAttachmentBatch(
  tx: SpaceTx,
  args: { baseId: string; baseRunId: string; diff: CommentAttachmentDiffResult; now?: Date },
): Promise<void> {
  const { baseId, baseRunId, diff } = args;
  const now = args.now ?? new Date();
  for (const u of diff.upserts) {
    // On conflict: refresh metadata + seen stamps + resurrect to active. Only
    // touch upload_status when resurrecting (→ pending) — otherwise leave the
    // lifecycle (pending/ready/uploaded) exactly as the writer set it.
    const conflictSet: Record<string, unknown> = {
      baseId,
      tableId: u.tableId,
      recordId: u.recordId,
      url: u.url,
      filename: u.filename,
      mimeType: u.mimeType,
      sizeBytes: u.sizeBytes,
      status: "active",
      lastSeenRun: baseRunId,
      lastSeenAt: now,
    };
    if (u.regressUploadStatus) conflictSet.uploadStatus = "pending";
    await tx
      .insert(spacePg.commentAttachments)
      .values({
        airtableCommentId: u.commentId,
        airtableAttachmentId: u.attachmentId,
        baseId,
        tableId: u.tableId,
        recordId: u.recordId,
        url: u.url,
        filename: u.filename,
        mimeType: u.mimeType,
        sizeBytes: u.sizeBytes,
        uploadStatus: "pending",
        status: "active",
        firstSeenRun: baseRunId,
        lastSeenRun: baseRunId,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: [
          spacePg.commentAttachments.airtableCommentId,
          spacePg.commentAttachments.airtableAttachmentId,
        ],
        set: conflictSet,
      });
  }
  for (const key of diff.deletions) {
    const sep = key.indexOf(":");
    if (sep < 0) continue;
    const commentId = key.slice(0, sep);
    const attachmentId = key.slice(sep + 1);
    await tx
      .update(spacePg.commentAttachments)
      .set({ status: "deleted" })
      .where(
        and(
          eq(spacePg.commentAttachments.airtableCommentId, commentId),
          eq(spacePg.commentAttachments.airtableAttachmentId, attachmentId),
        ),
      );
  }
}

/**
 * Record ids that hold `active` comment-attachment rows stuck below `uploaded`
 * — comments-plan force-refreshes these regardless of comment-count delta so a
 * fresh URL is issued (design Decision 3, recovery path).
 */
export async function readStuckCommentAttachmentRecords(
  tx: SpaceTx,
  baseId: string,
): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ recordId: spacePg.commentAttachments.recordId })
    .from(spacePg.commentAttachments)
    .where(
      and(
        eq(spacePg.commentAttachments.baseId, baseId),
        eq(spacePg.commentAttachments.status, "active"),
        sql`${spacePg.commentAttachments.uploadStatus} <> 'uploaded'`,
      ),
    );
  return rows.map((r) => r.recordId);
}

// ─────────────────── base collaborators (server-base-collaborators) ─────────
// principals (identity) + base_access (grants) + invite_links, plus the
// base_collab_meta side table (collaborators-sync.ts owns the pure ingest +
// diff). Per-base full-state replace: observed rows upsert active, absent
// active rows soft-delete; principals are never deleted.

export async function readBaseGrants(tx: SpaceTx, baseId: string): Promise<PriorGrant[]> {
  const rows = await tx
    .select({
      principalId: spacePg.baseAccess.principalId,
      baseId: spacePg.baseAccess.baseId,
      interfaceId: spacePg.baseAccess.interfaceId,
      scope: spacePg.baseAccess.scope,
      permissionLevel: spacePg.baseAccess.permissionLevel,
      status: spacePg.baseAccess.status,
    })
    .from(spacePg.baseAccess)
    .where(eq(spacePg.baseAccess.baseId, baseId));
  return rows;
}

export async function readBaseInviteLinks(tx: SpaceTx, baseId: string): Promise<PriorInviteLink[]> {
  const rows = await tx
    .select({
      airtableInviteId: spacePg.inviteLinks.airtableInviteId,
      baseId: spacePg.inviteLinks.baseId,
      interfaceId: spacePg.inviteLinks.interfaceId,
      linkScope: spacePg.inviteLinks.linkScope,
      status: spacePg.inviteLinks.status,
    })
    .from(spacePg.inviteLinks)
    .where(eq(spacePg.inviteLinks.baseId, baseId));
  return rows;
}

/**
 * Apply a collaborator capture: principals (fill-never-blank identity), grants
 * (upsert active + soft-delete absent), invite links (same), and the base-meta
 * side row. All keyed by the tables' unique indexes so retries are idempotent.
 */
export async function applyCollaboratorCapture(
  tx: SpaceTx,
  args: { baseRunId: string; ingest: IngestResult; diff: BaseAccessDiffResult; now?: Date },
): Promise<void> {
  const { baseRunId, ingest, diff } = args;
  const now = args.now ?? new Date();

  for (const p of ingest.principals) {
    await tx
      .insert(spacePg.principals)
      .values({
        principalId: p.principalId,
        kind: p.kind,
        email: p.email,
        name: p.name,
        firstSeenRun: baseRunId,
        lastSeenRun: baseRunId,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: spacePg.principals.principalId,
        set: {
          // fill-never-blank: keep an existing identity value, fill when NULL
          email: sql`coalesce(${spacePg.principals.email}, excluded.email)`,
          name: sql`coalesce(${spacePg.principals.name}, excluded.name)`,
          lastSeenRun: baseRunId,
          lastSeenAt: now,
        },
      });
  }

  for (const g of diff.grantUpserts) {
    await tx
      .insert(spacePg.baseAccess)
      .values({
        principalId: g.principalId,
        baseId: g.baseId,
        interfaceId: g.interfaceId,
        scope: g.scope,
        permissionLevel: g.permissionLevel,
        grantedByUserId: g.grantedByUserId,
        airtableCreatedTime: g.airtableCreatedTime,
        status: "active",
        firstSeenRun: baseRunId,
        lastSeenRun: baseRunId,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: [
          spacePg.baseAccess.baseId,
          spacePg.baseAccess.interfaceId,
          spacePg.baseAccess.scope,
          spacePg.baseAccess.principalId,
        ],
        set: {
          permissionLevel: g.permissionLevel,
          grantedByUserId: g.grantedByUserId,
          airtableCreatedTime: g.airtableCreatedTime,
          status: "active", // resurrect if it was deleted
          lastSeenRun: baseRunId,
          lastSeenAt: now,
        },
      });
  }
  for (const d of diff.grantDeletions) {
    await tx
      .update(spacePg.baseAccess)
      .set({ status: "deleted", lastSeenRun: baseRunId, lastSeenAt: now })
      .where(
        and(
          eq(spacePg.baseAccess.baseId, d.baseId),
          eq(spacePg.baseAccess.interfaceId, d.interfaceId),
          eq(spacePg.baseAccess.scope, d.scope),
          eq(spacePg.baseAccess.principalId, d.principalId),
        ),
      );
  }

  for (const l of diff.inviteUpserts) {
    await tx
      .insert(spacePg.inviteLinks)
      .values({
        airtableInviteId: l.airtableInviteId,
        baseId: l.baseId,
        interfaceId: l.interfaceId,
        linkScope: l.linkScope,
        invitedEmail: l.invitedEmail,
        permissionLevel: l.permissionLevel,
        referredByUserId: l.referredByUserId,
        restrictedToEmailDomains: l.restrictedToEmailDomains,
        type: l.type,
        airtableCreatedTime: l.airtableCreatedTime,
        status: "active",
        firstSeenRun: baseRunId,
        lastSeenRun: baseRunId,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: [
          spacePg.inviteLinks.baseId,
          spacePg.inviteLinks.interfaceId,
          spacePg.inviteLinks.linkScope,
          spacePg.inviteLinks.airtableInviteId,
        ],
        set: {
          invitedEmail: l.invitedEmail,
          permissionLevel: l.permissionLevel,
          referredByUserId: l.referredByUserId,
          restrictedToEmailDomains: l.restrictedToEmailDomains,
          type: l.type,
          airtableCreatedTime: l.airtableCreatedTime,
          status: "active",
          lastSeenRun: baseRunId,
          lastSeenAt: now,
        },
      });
  }
  for (const d of diff.inviteDeletions) {
    await tx
      .update(spacePg.inviteLinks)
      .set({ status: "deleted", lastSeenRun: baseRunId, lastSeenAt: now })
      .where(
        and(
          eq(spacePg.inviteLinks.baseId, d.baseId),
          eq(spacePg.inviteLinks.interfaceId, d.interfaceId),
          eq(spacePg.inviteLinks.linkScope, d.linkScope),
          eq(spacePg.inviteLinks.airtableInviteId, d.airtableInviteId),
        ),
      );
  }

  // Base-level stamps onto the bo_at_bases registry row (design Decision 5).
  // The base row is created by the schema capture; if a collaborators capture
  // somehow precedes it, upsert a minimal row so the stamps aren't lost.
  await tx
    .insert(spacePg.bases)
    .values({
      baseId: ingest.meta.baseId,
      name: "",
      workspaceId: ingest.meta.workspaceId,
      airtableCreatedTime: ingest.meta.airtableCreatedTime,
      ownPermissionLevel: ingest.meta.ownPermissionLevel,
    })
    .onConflictDoUpdate({
      target: spacePg.bases.baseId,
      set: {
        // fill-never-blank: don't wipe a known value with a missing one
        workspaceId: sql`coalesce(excluded.workspace_id, ${spacePg.bases.workspaceId})`,
        airtableCreatedTime: sql`coalesce(excluded.airtable_created_time, ${spacePg.bases.airtableCreatedTime})`,
        ownPermissionLevel: sql`coalesce(excluded.own_permission_level, ${spacePg.bases.ownPermissionLevel})`,
      },
    });

  // Capture record: retain the un-modeled packages block + raw payload.
  await tx
    .insert(spacePg.baseCollabMeta)
    .values({
      baseId: ingest.meta.baseId,
      packages: ingest.meta.packages ?? null,
      raw: ingest.meta.raw ?? null,
      lastSeenRun: baseRunId,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: spacePg.baseCollabMeta.baseId,
      set: {
        packages: ingest.meta.packages ?? null,
        raw: ingest.meta.raw ?? null,
        lastSeenRun: baseRunId,
        lastSeenAt: now,
      },
    });
}

/**
 * Space-wide access view (task 3.2b): every principal joined to its active
 * grants — the "who can touch what" listing, one row per (principal, base,
 * scope) with no per-base fan-out.
 */
export async function readSpaceAccessView(tx: SpaceTx): Promise<
  Array<{
    principalId: string;
    kind: string;
    email: string | null;
    name: string | null;
    baseId: string;
    interfaceId: string;
    scope: string;
    permissionLevel: string | null;
    grantedByUserId: string | null;
    airtableCreatedTime: Date | null;
    status: string;
  }>
> {
  return tx
    .select({
      principalId: spacePg.principals.principalId,
      kind: spacePg.principals.kind,
      email: spacePg.principals.email,
      name: spacePg.principals.name,
      baseId: spacePg.baseAccess.baseId,
      interfaceId: spacePg.baseAccess.interfaceId,
      scope: spacePg.baseAccess.scope,
      permissionLevel: spacePg.baseAccess.permissionLevel,
      grantedByUserId: spacePg.baseAccess.grantedByUserId,
      airtableCreatedTime: spacePg.baseAccess.airtableCreatedTime,
      status: spacePg.baseAccess.status,
    })
    .from(spacePg.principals)
    .innerJoin(spacePg.baseAccess, eq(spacePg.principals.principalId, spacePg.baseAccess.principalId))
    .where(eq(spacePg.baseAccess.status, "active"));
}

// ───────────────────────── media index (server-media-index) ─────────────────
// Asset/ref split keyed by the writer's content checksum (media-sync.ts owns
// the pure diff + wire types). Assets are never deleted by sync — refs
// dropping to zero stamps zero_ref_since for the retention machinery.

/** Prior ref rows for the batch's record ids — the diff's deletion scope. */
export async function readMediaWorkingSet(
  tx: SpaceTx,
  recordIds: string[],
): Promise<PriorAssetRef[]> {
  if (recordIds.length === 0) return [];
  const rows = await tx
    .select({
      attachmentId: spacePg.assetRefs.airtableAttachmentId,
      recordId: spacePg.assetRefs.recordId,
      status: spacePg.assetRefs.status,
    })
    .from(spacePg.assetRefs)
    .where(inArray(spacePg.assetRefs.recordId, recordIds));
  return rows;
}

/**
 * Write a media diff: asset upserts by checksum (metadata refreshed, id
 * captured for refs), ref upserts by attachment id (resurrects removed), ref
 * removals, then zero-ref maintenance — assets whose live refs vanished get
 * zero_ref_since stamped; assets that (re)gained an active ref get it cleared.
 */
export async function applyMediaBatch(
  tx: SpaceTx,
  args: { baseRunId: string; diff: MediaDiffResult; now?: Date },
): Promise<void> {
  const { baseRunId, diff } = args;
  const now = args.now ?? new Date();

  const assetIdByChecksum = new Map<string, string>();
  for (const a of diff.assetUpserts) {
    const [row] = await tx
      .insert(spacePg.assets)
      .values({
        checksum: a.checksum,
        contentType: a.contentType,
        contentClass: a.contentClass,
        sizeBytes: a.sizeBytes,
        storageKind: a.storageKind,
        storageProvider: a.storageProvider,
        storageRef: a.storageRef,
        zeroRefSince: null,
        firstSeenRun: baseRunId,
        lastSeenRun: baseRunId,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: spacePg.assets.checksum,
        set: {
          contentType: a.contentType,
          contentClass: a.contentClass,
          sizeBytes: a.sizeBytes,
          storageKind: a.storageKind,
          storageProvider: a.storageProvider,
          storageRef: a.storageRef,
          zeroRefSince: null,
          lastSeenRun: baseRunId,
          lastSeenAt: now,
        },
      })
      .returning({ id: spacePg.assets.id });
    if (row) assetIdByChecksum.set(a.checksum, row.id);
  }

  for (const r of diff.refUpserts) {
    const assetId = assetIdByChecksum.get(r.checksum);
    if (!assetId) continue; // asset entry was dropped in extraction — skip its ref
    await tx
      .insert(spacePg.assetRefs)
      .values({
        assetId,
        airtableAttachmentId: r.attachmentId,
        baseId: r.baseId,
        tableId: r.tableId,
        recordId: r.recordId,
        fieldId: r.fieldId,
        filename: r.filename,
        status: "active",
        firstSeenRun: baseRunId,
        lastSeenRun: baseRunId,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: spacePg.assetRefs.airtableAttachmentId,
        set: {
          assetId,
          baseId: r.baseId,
          tableId: r.tableId,
          recordId: r.recordId,
          fieldId: r.fieldId,
          filename: r.filename,
          status: "active",
          lastSeenRun: baseRunId,
          lastSeenAt: now,
        },
      });
  }

  if (diff.refRemovals.length) {
    await tx
      .update(spacePg.assetRefs)
      .set({ status: "removed" })
      .where(inArray(spacePg.assetRefs.airtableAttachmentId, diff.refRemovals));
  }

  // Zero-ref maintenance: stamp assets with no live refs (removal candidates
  // for retention — never deleted here); clear the stamp when refs live again.
  await tx.execute(sql`
    UPDATE ${spacePg.assets} a SET zero_ref_since = ${now.toISOString()}::timestamptz
    WHERE a.zero_ref_since IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM ${spacePg.assetRefs} r
        WHERE r.asset_id = a.id AND r.status = 'active'
      )`);
  await tx.execute(sql`
    UPDATE ${spacePg.assets} a SET zero_ref_since = NULL
    WHERE a.zero_ref_since IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM ${spacePg.assetRefs} r
        WHERE r.asset_id = a.id AND r.status = 'active'
      )`);
}

/** Filters shared by the list + totals reads. */
export interface MediaFilters {
  classes?: string[];
  baseId?: string;
  tableId?: string;
  minSize?: number;
  maxSize?: number;
  capturedAfter?: Date;
  capturedBefore?: Date;
}

function mediaFilterConditions(f: MediaFilters) {
  const conds = [];
  if (f.classes?.length) conds.push(inArray(spacePg.assets.contentClass, f.classes));
  if (f.minSize !== undefined) conds.push(sql`${spacePg.assets.sizeBytes} >= ${f.minSize}`);
  if (f.maxSize !== undefined) conds.push(sql`${spacePg.assets.sizeBytes} <= ${f.maxSize}`);
  if (f.capturedAfter) conds.push(sql`${spacePg.assets.firstSeenAt} >= ${f.capturedAfter.toISOString()}::timestamptz`);
  if (f.capturedBefore) conds.push(sql`${spacePg.assets.firstSeenAt} <= ${f.capturedBefore.toISOString()}::timestamptz`);
  if (f.baseId || f.tableId) {
    conds.push(sql`EXISTS (
      SELECT 1 FROM ${spacePg.assetRefs} fr
      WHERE fr.asset_id = ${spacePg.assets.id} AND fr.status = 'active'
      ${f.baseId ? sql`AND fr.base_id = ${f.baseId}` : sql``}
      ${f.tableId ? sql`AND fr.table_id = ${f.tableId}` : sql``}
    )`);
  }
  return conds;
}

export interface MediaAssetRow {
  id: string;
  checksum: string;
  contentType: string | null;
  contentClass: string;
  sizeBytes: number | null;
  storageKind: string | null;
  storageProvider: string | null;
  storageRef: string | null;
  thumbnailStatus: string;
  thumbnailKey: string | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  refs: {
    attachmentId: string;
    baseId: string;
    tableId: string;
    recordId: string;
    fieldId: string;
    filename: string | null;
    status: string;
  }[];
}

/**
 * Media Library list read: newest-first keyset pagination on
 * (first_seen_at DESC, id DESC); each item carries its refs.
 */
export async function listMediaAssets(
  tx: SpaceTx,
  args: MediaFilters & { cursor?: { firstSeenAt: Date; id: string }; limit: number },
): Promise<{ items: MediaAssetRow[]; nextCursor: { firstSeenAt: Date; id: string } | null }> {
  const conds = mediaFilterConditions(args);
  if (args.cursor) {
    conds.push(
      sql`(${spacePg.assets.firstSeenAt}, ${spacePg.assets.id}) < (${args.cursor.firstSeenAt.toISOString()}::timestamptz, ${args.cursor.id}::uuid)`,
    );
  }
  const rows = await tx
    .select()
    .from(spacePg.assets)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(sql`${spacePg.assets.firstSeenAt} DESC NULLS LAST`, sql`${spacePg.assets.id} DESC`)
    .limit(args.limit + 1);

  const page = rows.slice(0, args.limit);
  const refs = page.length
    ? await tx
        .select()
        .from(spacePg.assetRefs)
        .where(inArray(spacePg.assetRefs.assetId, page.map((r) => r.id)))
    : [];
  const refsByAsset = new Map<string, MediaAssetRow["refs"]>();
  for (const r of refs) {
    const list = refsByAsset.get(r.assetId) ?? [];
    list.push({
      attachmentId: r.airtableAttachmentId,
      baseId: r.baseId,
      tableId: r.tableId,
      recordId: r.recordId,
      fieldId: r.fieldId,
      filename: r.filename,
      status: r.status,
    });
    refsByAsset.set(r.assetId, list);
  }
  const items = page.map((r) => ({
    id: r.id,
    checksum: r.checksum,
    contentType: r.contentType,
    contentClass: r.contentClass,
    sizeBytes: r.sizeBytes,
    storageKind: r.storageKind,
    storageProvider: r.storageProvider,
    storageRef: r.storageRef,
    thumbnailStatus: r.thumbnailStatus,
    thumbnailKey: r.thumbnailKey,
    firstSeenAt: r.firstSeenAt,
    lastSeenAt: r.lastSeenAt,
    refs: refsByAsset.get(r.id) ?? [],
  }));
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > args.limit && last?.firstSeenAt ? { firstSeenAt: last.firstSeenAt, id: last.id } : null;
  return { items, nextCursor };
}

/** Count + summed size for the current filter — the storage-bill lens. */
export async function mediaTotals(
  tx: SpaceTx,
  filters: MediaFilters,
): Promise<{ count: number; sizeBytes: number }> {
  const conds = mediaFilterConditions(filters);
  const [row] = await tx
    .select({
      count: sql<number>`count(*)::int`,
      sizeBytes: sql<number>`coalesce(sum(${spacePg.assets.sizeBytes}), 0)::bigint`,
    })
    .from(spacePg.assets)
    .where(conds.length ? and(...conds) : undefined);
  return { count: row?.count ?? 0, sizeBytes: Number(row?.sizeBytes ?? 0) };
}

/** Detail read: the asset + all refs (capture history = the run/at stamps). */
export async function getMediaAsset(tx: SpaceTx, assetId: string): Promise<
  | (MediaAssetRow & { firstSeenRun: string | null; lastSeenRun: string | null; zeroRefSince: Date | null })
  | null
> {
  const [r] = await tx.select().from(spacePg.assets).where(eq(spacePg.assets.id, assetId)).limit(1);
  if (!r) return null;
  const refs = await tx.select().from(spacePg.assetRefs).where(eq(spacePg.assetRefs.assetId, assetId));
  return {
    id: r.id,
    checksum: r.checksum,
    contentType: r.contentType,
    contentClass: r.contentClass,
    sizeBytes: r.sizeBytes,
    storageKind: r.storageKind,
    storageProvider: r.storageProvider,
    storageRef: r.storageRef,
    thumbnailStatus: r.thumbnailStatus,
    thumbnailKey: r.thumbnailKey,
    firstSeenAt: r.firstSeenAt,
    lastSeenAt: r.lastSeenAt,
    firstSeenRun: r.firstSeenRun,
    lastSeenRun: r.lastSeenRun,
    zeroRefSince: r.zeroRefSince,
    refs: refs.map((ref) => ({
      attachmentId: ref.airtableAttachmentId,
      baseId: ref.baseId,
      tableId: ref.tableId,
      recordId: ref.recordId,
      fieldId: ref.fieldId,
      filename: ref.filename,
      status: ref.status,
    })),
  };
}

/**
 * The comments-plan counts read (design Decision 5): recordId → active-comment
 * count, grouped over bo_at_comments — no stored count column to drift.
 */
export async function readActiveCommentCounts(
  tx: SpaceTx,
  baseId: string,
): Promise<Map<string, number>> {
  const rows = await tx
    .select({
      recordId: spacePg.comments.recordId,
      count: sql<number>`count(*)::int`,
    })
    .from(spacePg.comments)
    .where(and(eq(spacePg.comments.baseId, baseId), eq(spacePg.comments.status, "active")))
    .groupBy(spacePg.comments.recordId);
  return new Map(rows.map((r) => [r.recordId, r.count]));
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

// ───────────────────────── automations (MCP capture) ─────────────────────────
// server-mcp-automations. MCP diffing reads/writes ONLY submitted_via='mcp'
// rows in the EXISTING bo_at_automations table — manually-submitted rows for
// the same airtable_entity_id are parallel and never touched. Unlike the
// interface tables, bo_at_automations keeps its submission-driven TIMESTAMP
// lifecycle (first_seen_at / last_seen_at + status): the changelog's
// automation-removals reader (schema-changelog-io.ts) already consumes exactly
// that shape, so no migration and no new changelog reader are needed. The
// capture time (capturedAt from the wire field) is the stamp source, not the
// run id.

export async function readAutomationWorkingSet(
  tx: SpaceTx,
  baseId: string,
): Promise<PriorAutomationWorkingSet> {
  const automations = await tx
    .select({
      id: spacePg.automations.id,
      airtableEntityId: spacePg.automations.airtableEntityId,
      name: spacePg.automations.name,
      definition: spacePg.automations.definition,
      status: spacePg.automations.status,
    })
    .from(spacePg.automations)
    .where(and(eq(spacePg.automations.baseId, baseId), eq(spacePg.automations.submittedVia, "mcp")));
  return { automations };
}

export async function applyAutomationDiff(
  tx: SpaceTx,
  args: { baseId: string; baseRunId: string; capturedAt: Date; diff: AutomationDiffResult },
): Promise<void> {
  const { baseId, baseRunId: runId, capturedAt, diff } = args;

  if (diff.unchanged) {
    // Identical capture: freshness is still stamped on every active MCP row.
    await tx
      .update(spacePg.automations)
      .set({ lastSeenAt: capturedAt })
      .where(
        and(
          eq(spacePg.automations.baseId, baseId),
          eq(spacePg.automations.submittedVia, "mcp"),
          eq(spacePg.automations.status, "active"),
        ),
      );
    return;
  }

  if (diff.automations.inserts.length) {
    await tx.insert(spacePg.automations).values(
      diff.automations.inserts.map((e) => ({
        baseId,
        airtableEntityId: e.airtableEntityId,
        name: e.name,
        definition: e.definition,
        status: "active",
        submittedVia: "mcp",
        firstSeenAt: capturedAt,
        lastSeenAt: capturedAt,
      })),
    );
  }
  for (const { rowId, entity } of diff.automations.seen) {
    await tx
      .update(spacePg.automations)
      .set({ name: entity.name, definition: entity.definition, status: "active", lastSeenAt: capturedAt })
      .where(eq(spacePg.automations.id, rowId));
  }
  for (const { rowId } of diff.automations.removals) {
    // last_seen_at stays at the last sighting — the changelog removals reader
    // uses it as the removal timestamp.
    await tx
      .update(spacePg.automations)
      .set({ status: "removed" })
      .where(eq(spacePg.automations.id, rowId));
  }

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
