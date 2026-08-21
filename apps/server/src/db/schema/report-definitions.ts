// MIRROR of apps/web/src/db/schema/core.ts (reportDefinitions — canonical writer).
// Migration: apps/web/drizzle/0038_reports.sql
//
// A report is a named DEFINITION: which sections, which bases, what time
// window, plus one embedded delivery schedule (1:1, or none for manual-only).
// apps/web INSERTs the row (default report on Space creation + user-created
// definitions); apps/server READS the definition to assemble a run and to
// evaluate weekly/monthly schedules, and WRITES `next_run_at` when it recomputes
// the next fire. This file is never migrated from — see CLAUDE.md §5.3.

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

/** A schedule recipient, stored in `schedule_recipients`. */
export interface ReportRecipient {
  kind: "member" | "external";
  email: string;
  name?: string;
}

export const reportDefinitions = baseout.table("report_definitions", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text("space_id").notNull(),
  name: text("name").notNull(),
  // Subset of backups | connections | schema | docs | trends | dataHealth.
  sections: jsonb("sections").$type<string[]>().notNull(),
  // Array of Base ids; NULL = all bases in the Space.
  baseScope: jsonb("base_scope").$type<string[]>(),
  windowKind: text("window_kind").notNull().default("since_last"),
  // 'since_last' | 'rolling' | 'all_time'
  windowDays: integer("window_days"),
  isDefault: boolean("is_default").notNull().default(false),
  // NULL = manual-only. Otherwise 'data_backup' | 'schema_backup' | 'weekly' | 'monthly'.
  scheduleCadence: text("schedule_cadence"),
  scheduleDay: integer("schedule_day"),
  scheduleTime: text("schedule_time"),
  scheduleFormats: jsonb("schedule_formats")
    .$type<string[]>()
    .notNull()
    .default(sql`'["pdf"]'::jsonb`),
  scheduleRecipients: jsonb("schedule_recipients")
    .$type<ReportRecipient[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  scheduleSuppressEmpty: boolean("schedule_suppress_empty").notNull().default(true),
  scheduleEnabled: boolean("schedule_enabled").notNull().default(true),
  // Engine WRITES this on schedule recompute; NULL for event/manual cadences.
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReportDefinitionRow = typeof reportDefinitions.$inferSelect;
