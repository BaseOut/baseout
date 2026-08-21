// MIRROR of apps/web/src/db/schema/core.ts:85 (canonical writer).
// Migrations: apps/web/drizzle/0000_deep_freak.sql (initial).
//
// apps/server reads owner/admin membership to determine whether an Organization
// is internally owned/administered by @openside.com staff for entitlement
// override purposes. The engine never writes memberships.
//
// Columns intentionally omitted: isDefault, invitedByUserId, invitedAt,
// acceptedAt, createdAt, modifiedAt — engine doesn't read them.
//
// Per CLAUDE.md §5.3.

import { pgSchema, text } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const organizationMembers = baseout.table("organization_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
});

export type OrganizationMemberRow = typeof organizationMembers.$inferSelect;
