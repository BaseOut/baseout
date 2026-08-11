// MIRROR of apps/web/src/db/schema/core.ts:37 (canonical writer).
// Migrations: apps/web/drizzle/0000_deep_freak.sql (initial)
//
// Seeded reference table — not user-editable. apps/server reads the slug
// for join filters (e.g. `WHERE platforms.slug = 'airtable'`) inside the
// SpaceDO scheduler (Phase B of baseout-backup-schedule-and-cancel) and
// the run-start dep factory.
//
// Columns intentionally omitted: code, name, iconUrl, websiteUrl,
// isActive, createdAt, modifiedAt — engine doesn't read them.
//
// Per CLAUDE.md §5.3.

import { pgSchema, text } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const platforms = baseout.table("platforms", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  // 'airtable' | 'notion' | 'hubspot' (Phase V1 — airtable only)
});

export type PlatformRow = typeof platforms.$inferSelect;
