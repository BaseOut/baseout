// MIRROR of apps/web/src/db/schema/core.ts organizations (id + runtime_env).
// Migration: db/migrations/0040_org_runtime_env.sql
//
// Engine listings (OAuth refresh, run-start) join this so a shared master DB
// cannot decrypt or back up the other Worker's Organizations.

import { pgSchema, text } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const organizations = baseout.table("organizations", {
  id: text("id").primaryKey(),
  runtimeEnv: text("runtime_env").notNull(),
});
