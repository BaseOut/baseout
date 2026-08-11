// MIRROR of apps/web/src/db/schema/core.ts (canonical writer).
// Migration: apps/web/drizzle/0008_workspace_rediscovery.sql
//
// Tiny per-Space notification surface. apps/web reads unread rows on SSR
// and renders an inline banner; apps/web exposes a dismiss route that
// sets dismissed_at. apps/server is a SECONDARY writer — it INSERTs rows
// during workspace rediscovery (alarm + manual rescan paths) to surface
// 'bases_discovered' events to the user.
//
// Columns intentionally omitted: dismissedAt — engine only writes;
// dismiss + read are apps/web concerns.
//
// Per CLAUDE.md §5.3.

import { jsonb, pgSchema, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const spaceEvents = baseout.table("space_events", {
  // .default mirrors the canonical DB default so engine INSERTs from
  // workspace rediscovery can omit `id`.
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text("space_id").notNull(),
  kind: text("kind").notNull(),
  // 'bases_discovered' (V1) — additive
  payload: jsonb("payload").notNull(),
});

export type SpaceEventRow = typeof spaceEvents.$inferSelect;
