// Per-Space relationship I/O (server-relationships).
//
// Runs inside `withSpaceSchema(...)`. API-derived relationships are computed on
// read from bo_at_fields/bo_at_tables (pure `deriveRelationships`); only synced-
// view candidates persist (bo_at_synced_view_candidates) — the inference task
// upserts them, and the user confirms/dismisses. Mirrors health-io.ts.

import { and, eq } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { SpaceTx } from "./space-db-pg";
import {
  deriveRelationships,
  type DerivedRelationship,
} from "./relationships";
import { inferSyncedViews } from "./synced-view-infer";

export interface SyncedViewRelationship {
  id: string; // the bo_at_synced_view_candidates.id
  baseId: string;
  type: "syncedViews";
  sourceTableId: string;
  sourceTableName: string;
  destTableId: string;
  destTableName: string;
  status: string; // inferred | confirmed | dismissed
  origin: string; // inferred | user
  inferred: boolean; // status === 'inferred'
  matchScore: number | null;
  matchedPairs: unknown;
}

export interface RelationshipsOverview {
  derived: DerivedRelationship[];
  syncedViews: SyncedViewRelationship[];
}

/**
 * Read a base's relationships: the API-derived set (from fields/tables) plus the
 * synced-view candidates. Dismissed candidates are excluded by default.
 */
export async function readRelationships(
  tx: SpaceTx,
  baseId: string,
  opts?: { includeDismissed?: boolean },
): Promise<RelationshipsOverview> {
  const tableRows = await tx
    .select({
      tableId: spacePg.tables.tableId,
      baseId: spacePg.tables.baseId,
      name: spacePg.tables.name,
      status: spacePg.tables.status,
    })
    .from(spacePg.tables)
    .where(eq(spacePg.tables.baseId, baseId));

  const fieldRows = await tx
    .select({
      fieldId: spacePg.fields.fieldId,
      tableId: spacePg.fields.tableId,
      baseId: spacePg.fields.baseId,
      name: spacePg.fields.name,
      type: spacePg.fields.type,
      options: spacePg.fields.options,
      status: spacePg.fields.status,
    })
    .from(spacePg.fields)
    .where(eq(spacePg.fields.baseId, baseId));

  const derived = deriveRelationships({ tables: tableRows, fields: fieldRows });
  const tableName = new Map(tableRows.map((t) => [t.tableId, t.name]));

  const candRows = await tx
    .select({
      id: spacePg.syncedViewCandidates.id,
      baseId: spacePg.syncedViewCandidates.baseId,
      sourceTableId: spacePg.syncedViewCandidates.sourceTableId,
      destTableId: spacePg.syncedViewCandidates.destTableId,
      status: spacePg.syncedViewCandidates.status,
      origin: spacePg.syncedViewCandidates.origin,
      matchScore: spacePg.syncedViewCandidates.matchScore,
      matchedPairs: spacePg.syncedViewCandidates.matchedPairs,
    })
    .from(spacePg.syncedViewCandidates)
    .where(eq(spacePg.syncedViewCandidates.baseId, baseId));

  const syncedViews: SyncedViewRelationship[] = candRows
    .filter((r) => opts?.includeDismissed || r.status !== "dismissed")
    .map((r) => ({
      id: r.id,
      baseId: r.baseId,
      type: "syncedViews" as const,
      sourceTableId: r.sourceTableId,
      sourceTableName: tableName.get(r.sourceTableId) ?? r.sourceTableId,
      destTableId: r.destTableId,
      destTableName: tableName.get(r.destTableId) ?? r.destTableId,
      status: r.status,
      origin: r.origin,
      inferred: r.status === "inferred",
      matchScore: r.matchScore,
      matchedPairs: r.matchedPairs,
    }));

  return { derived, syncedViews };
}

export interface InferredCandidate {
  baseId: string;
  sourceTableId: string;
  destTableId: string;
  matchScore: number;
  matchedPairs: unknown;
}

/**
 * Upsert inferred synced-view candidates from an inference run. Existing
 * `dismissed` candidates are left untouched (never re-proposed); `confirmed`
 * keep their status but refresh match data + last_seen_run; new pairs insert as
 * `inferred`. Returns counts.
 */
export async function writeSyncedViewCandidates(
  tx: SpaceTx,
  args: { baseId: string; runId: string; candidates: InferredCandidate[] },
): Promise<{ inserted: number; refreshed: number; skipped: number }> {
  const now = new Date();
  let inserted = 0;
  let refreshed = 0;
  let skipped = 0;

  for (const c of args.candidates) {
    const existing = await tx
      .select({
        id: spacePg.syncedViewCandidates.id,
        status: spacePg.syncedViewCandidates.status,
      })
      .from(spacePg.syncedViewCandidates)
      .where(
        and(
          eq(spacePg.syncedViewCandidates.baseId, c.baseId),
          eq(spacePg.syncedViewCandidates.sourceTableId, c.sourceTableId),
          eq(spacePg.syncedViewCandidates.destTableId, c.destTableId),
        ),
      )
      .limit(1);

    const row = existing[0];
    if (!row) {
      await tx.insert(spacePg.syncedViewCandidates).values({
        baseId: c.baseId,
        sourceTableId: c.sourceTableId,
        destTableId: c.destTableId,
        status: "inferred",
        origin: "inferred",
        matchScore: c.matchScore,
        matchedPairs: c.matchedPairs,
        firstSeenRun: args.runId,
        lastSeenRun: args.runId,
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
      continue;
    }
    if (row.status === "dismissed") {
      skipped++;
      continue;
    }
    await tx
      .update(spacePg.syncedViewCandidates)
      .set({
        matchScore: c.matchScore,
        matchedPairs: c.matchedPairs,
        lastSeenRun: args.runId,
        updatedAt: now,
      })
      .where(eq(spacePg.syncedViewCandidates.id, row.id));
    refreshed++;
  }

  return { inserted, refreshed, skipped };
}

/**
 * Run the synced-view inference for a base off the per-Space schema and upsert
 * the candidates. The heuristic runs engine-side (data locality), triggered per
 * run via /relationships/sync; dismissed pairs are read first so they are never
 * re-proposed (belt-and-suspenders with writeSyncedViewCandidates' skip).
 */
export async function inferAndWriteSyncedViews(
  tx: SpaceTx,
  args: { baseId: string; runId: string },
): Promise<{ inserted: number; refreshed: number; skipped: number; proposed: number }> {
  const tableRows = await tx
    .select({
      tableId: spacePg.tables.tableId,
      baseId: spacePg.tables.baseId,
      name: spacePg.tables.name,
    })
    .from(spacePg.tables)
    .where(eq(spacePg.tables.baseId, args.baseId));

  const fieldRows = await tx
    .select({
      tableId: spacePg.fields.tableId,
      name: spacePg.fields.name,
      type: spacePg.fields.type,
    })
    .from(spacePg.fields)
    .where(eq(spacePg.fields.baseId, args.baseId));

  const dismissedRows = await tx
    .select({
      sourceTableId: spacePg.syncedViewCandidates.sourceTableId,
      destTableId: spacePg.syncedViewCandidates.destTableId,
    })
    .from(spacePg.syncedViewCandidates)
    .where(
      and(
        eq(spacePg.syncedViewCandidates.baseId, args.baseId),
        eq(spacePg.syncedViewCandidates.status, "dismissed"),
      ),
    );

  const candidates = inferSyncedViews({
    tables: tableRows,
    fields: fieldRows,
    dismissed: dismissedRows,
  });

  const written = await writeSyncedViewCandidates(tx, {
    baseId: args.baseId,
    runId: args.runId,
    candidates: candidates.map((c) => ({
      baseId: c.baseId,
      sourceTableId: c.sourceTableId,
      destTableId: c.destTableId,
      matchScore: c.matchScore,
      matchedPairs: c.matchedPairs,
    })),
  });

  return { ...written, proposed: candidates.length };
}

/** Confirm or dismiss an inferred synced-view candidate. */
export async function setSyncedViewStatus(
  tx: SpaceTx,
  args: { id: string; status: "confirmed" | "dismissed" },
): Promise<boolean> {
  const updated = await tx
    .update(spacePg.syncedViewCandidates)
    .set({ status: args.status, updatedAt: new Date() })
    .where(eq(spacePg.syncedViewCandidates.id, args.id))
    .returning({ id: spacePg.syncedViewCandidates.id });
  return updated.length > 0;
}

/**
 * Create a user-authored synced view (origin='user', status='confirmed').
 * Idempotent on the unique (base, source, dest) pair: if one exists it is
 * promoted to confirmed/user rather than duplicated.
 */
export async function createUserSyncedView(
  tx: SpaceTx,
  args: { baseId: string; sourceTableId: string; destTableId: string },
): Promise<{ id: string }> {
  const now = new Date();
  const existing = await tx
    .select({ id: spacePg.syncedViewCandidates.id })
    .from(spacePg.syncedViewCandidates)
    .where(
      and(
        eq(spacePg.syncedViewCandidates.baseId, args.baseId),
        eq(spacePg.syncedViewCandidates.sourceTableId, args.sourceTableId),
        eq(spacePg.syncedViewCandidates.destTableId, args.destTableId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await tx
      .update(spacePg.syncedViewCandidates)
      .set({ status: "confirmed", origin: "user", updatedAt: now })
      .where(eq(spacePg.syncedViewCandidates.id, existing[0].id));
    return { id: existing[0].id };
  }

  const inserted = await tx
    .insert(spacePg.syncedViewCandidates)
    .values({
      baseId: args.baseId,
      sourceTableId: args.sourceTableId,
      destTableId: args.destTableId,
      status: "confirmed",
      origin: "user",
      matchScore: null,
      matchedPairs: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: spacePg.syncedViewCandidates.id });
  return { id: inserted[0]!.id };
}
