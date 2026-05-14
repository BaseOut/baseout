// MIRROR of apps/web/src/db/schema/core.ts:154 (canonical writer).
// Migrations: apps/web/drizzle/0000_deep_freak.sql
//             apps/web/drizzle/0008_workspace_rediscovery.sql
//             (adds discovered_via, first_seen_at — written by the engine on
//             workspace rediscovery upsert)
//
// Pure registry of Airtable bases known within a Space. apps/web writes
// rows after each scan-bases call against the Airtable Metadata API.
// The engine ALSO writes rows during workspace rediscovery (alarm-time or
// manual rescan), setting `discovered_via` to 'rediscovery_scheduled' or
// 'rediscovery_manual' on INSERT, and bumping `last_seen_at` on every
// upsert. apps/server reads `at_base_id` and `name` on run-start.
//
// Columns intentionally omitted: createdAt, modifiedAt — engine doesn't
// read or write them (defaults handle).
//
// Per CLAUDE.md §5.3.

import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const atBases = baseout.table("at_bases", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull(),
  atBaseId: text("at_base_id").notNull(),
  name: text("name").notNull(),
  discoveredVia: text("discovered_via").notNull(),
  // 'oauth_callback' | 'rediscovery_scheduled' | 'rediscovery_manual'.
  // Engine sets on INSERT only; on upsert conflict the column is omitted
  // from the set-list so the original discovery source is preserved.
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
  // Set by the DB default on first insert. Engine reads but does not write.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  // Engine bumps on every rediscovery upsert.
});

export type AtBaseRow = typeof atBases.$inferSelect;
