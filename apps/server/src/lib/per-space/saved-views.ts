// Per-Space saved views — Drizzle CRUD over a SpaceTx (Postgres backend).
// server-saved-views D2. Thin I/O: request validation lives in
// ./saved-views-logic.ts. `config` is stored opaquely (the web-owned
// SerializedConfig) — never inspected here. Runs inside `withSpaceSchema(...)`
// so the unqualified bo_at_saved_views table resolves into the Space's schema.

import { asc, eq } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { SpaceTx } from "./space-db-pg";
import type { SavedViewCreateInput, SavedViewPatch } from "./saved-views-logic";

/** Saved presets, stable order: sort_order then created_at (design D4). */
export async function listSavedViews(tx: SpaceTx) {
  return tx
    .select()
    .from(spacePg.savedViews)
    .orderBy(asc(spacePg.savedViews.sortOrder), asc(spacePg.savedViews.createdAt));
}

export async function getSavedView(tx: SpaceTx, id: string) {
  const [row] = await tx.select().from(spacePg.savedViews).where(eq(spacePg.savedViews.id, id)).limit(1);
  return row ?? null;
}

export async function createSavedView(tx: SpaceTx, input: SavedViewCreateInput) {
  const now = new Date();
  const [row] = await tx
    .insert(spacePg.savedViews)
    .values({
      name: input.name,
      tableId: input.tableId,
      config: input.config,
      pinned: input.pinned ?? false,
      sortOrder: input.sortOrder ?? 0,
      createdByUserId: input.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row!;
}

/** Patch name/config/pinned/sortOrder (tableId immutable — validated upstream). */
export async function updateSavedView(tx: SpaceTx, id: string, patch: SavedViewPatch) {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.config !== undefined) set.config = patch.config;
  if (patch.pinned !== undefined) set.pinned = patch.pinned;
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;
  const [row] = await tx.update(spacePg.savedViews).set(set).where(eq(spacePg.savedViews.id, id)).returning();
  return row ?? null;
}

/** Delete a saved view. Returns whether it existed. */
export async function deleteSavedView(tx: SpaceTx, id: string): Promise<boolean> {
  const deleted = await tx
    .delete(spacePg.savedViews)
    .where(eq(spacePg.savedViews.id, id))
    .returning({ id: spacePg.savedViews.id });
  return deleted.length > 0;
}
