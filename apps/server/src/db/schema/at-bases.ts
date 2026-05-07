// MIRROR of apps/web/src/db/schema/core.ts:154 (canonical writer).
// Migration: apps/web/drizzle/0000_deep_freak.sql
//
// Pure registry of Airtable bases known within a Space. apps/web writes
// rows after each scan-bases call against the Airtable Metadata API.
// apps/server reads `at_base_id` (the Airtable-side ID, e.g. "appXXXXXX")
// and `name` (cached display name used in CSV path layout) on run-start.
//
// Columns intentionally omitted: lastSeenAt, createdAt, modifiedAt — engine
// doesn't read them today.
//
// Per CLAUDE.md §5.3.

import { pgSchema, text } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const atBases = baseout.table("at_bases", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull(),
  atBaseId: text("at_base_id").notNull(),
  name: text("name").notNull(),
});

export type AtBaseRow = typeof atBases.$inferSelect;
