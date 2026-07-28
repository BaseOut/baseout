// MIRROR of apps/web/src/db/schema/core.ts (canonical writer:
// web-workspace-bases migration).
//
// Per-Space workspace ENROLLMENT — intent, not membership (which lives on
// at_bases.workspace_id): "this Space auto-adds bases from these Airtable
// workspaces". apps/web owns enroll/un-enroll (PUT /api/spaces/:id/
// workspaces); the engine READS rows during the run-start auto-enroll check
// (server-mcp-workspaces) and WRITES two things: `enrolled_via='auto'` rows
// when the standing backup_configurations.auto_enroll_new_workspaces flag
// sees a brand-new workspace, and last_checked_at stamps after every check.
//
// Columns intentionally omitted: createdAt / modifiedAt.
//
// Per CLAUDE.md §5.3.

import { boolean, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const spaceWorkspaces = baseout.table("space_workspaces", {
  // .default mirrors the canonical DB default so engine INSERTs (auto-enroll)
  // can omit `id`.
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text("space_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  workspaceName: text("workspace_name"),
  autoEnrollFutureBases: boolean("auto_enroll_future_bases").notNull().default(false),
  enrolledVia: text("enrolled_via").notNull().default("manual"),
  // 'manual' | 'auto' — auto rows are materialized by the engine when the
  // standing new-workspaces flag first sees a workspace.
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  // Engine stamps after every run-start check (settings UI freshness).
});

export type SpaceWorkspaceRow = typeof spaceWorkspaces.$inferSelect;
