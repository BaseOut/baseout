// MIRROR of packages/db-schema/src/schema/auth.ts (canonical writer via apps/web).
// Migrations: apps/web owns Better Auth tables.
//
// apps/server reads `email` only to apply the internal @openside.com entitlement
// override. It never writes users or sessions. Columns intentionally omitted:
// all Better Auth profile/session fields except the stable identity fields used
// by the entitlement resolver.
//
// Per CLAUDE.md §5.3.

import { pgSchema, text } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const users = baseout.table("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
});

export type UserRow = typeof users.$inferSelect;
