// MIRROR of apps/web/src/db/schema/core.ts:restoreRuns (canonical writer).
// Migration: apps/web/drizzle/0019_shallow_mattie_franklin.sql
//
// apps/web INSERTs each row when the user initiates a restore.
// apps/server flips status (queued → running → succeeded | failed |
// cancelling | cancelled), writes per-base counts on completion, and stores
// the fan-out array of Trigger.dev run IDs in trigger_run_ids.
//
// Columns the engine neither reads nor writes are intentionally omitted —
// add them when the engine actually needs them. Never migrate from this side.
//
// Per CLAUDE.md §5.3 / §2.

import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const restoreRuns = baseout.table("restore_runs", {
  // .default mirrors the canonical DB default (gen_random_uuid()) so
  // Drizzle's INSERT-type surface lets us omit `id` on engine-initiated rows.
  // This file is never migrated from — see header.
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text("space_id").notNull(),
  connectionId: text("connection_id").notNull(),
  sourceRunId: text("source_run_id").notNull(),
  // FK → backup_runs(id) — canonical migration owns the constraint.
  status: text("status").notNull(),
  // 'queued' | 'running' | 'cancelling' | 'cancelled' | 'succeeded' | 'failed'
  scope: text("scope").notNull(),
  // 'base' | 'table' | 'point_in_time'
  scopeTarget: jsonb("scope_target").notNull().$type<{
    baseId: string;
    tableId?: string;
    runId?: string;
  }>(),
  tablesRestored: integer("tables_restored").notNull().default(0),
  recordsRestored: integer("records_restored").notNull().default(0),
  attachmentsRestored: integer("attachments_restored").notNull().default(0),
  triggerRunIds: text("trigger_run_ids").array().notNull().default(sql`'{}'`),
  // Postgres text[] — one entry per Trigger.dev run ID fanned out on start.
  triggeredBy: text("triggered_by").notNull(),
  // 'user_manual' | 'admin_override'
  isTrial: boolean("is_trial").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  modifiedAt: timestamp("modified_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // .defaultNow() mirrors the canonical DB default. This file is never
  // migrated from — see header.
});

export type RestoreRunRow = typeof restoreRuns.$inferSelect;
