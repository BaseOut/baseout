// MIRROR of apps/web/src/db/schema/core.ts:108 (canonical writer).
// Migrations: apps/web/drizzle/0000_deep_freak.sql (initial)
//
// apps/web writes spaces during onboarding. apps/server reads
// `organization_id` from the SpaceDO scheduler (Phase B of
// baseout-backup-schedule-and-cancel) to resolve the Org's active
// Airtable connection on alarm fire.
//
// Columns intentionally omitted: name, status, spaceType, onboardingStep,
// onboardingCompletedAt, createdAt, modifiedAt — engine doesn't read them.
//
// Per CLAUDE.md §5.3.

import { pgSchema, text } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const spaces = baseout.table("spaces", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
});

export type SpaceRow = typeof spaces.$inferSelect;
