// MIRROR of apps/web/src/db/schema/core.ts (reportRuns — canonical writer).
// Migration: apps/web/drizzle/0038_reports.sql
//
// The run history for a report definition; a run's rendered document is a
// versioned ReportDetail JSON artifact. apps/web owns the migration; apps/server
// is the primary writer of run state: it INSERTs a `running` row (guarded by the
// partial-unique one-running-per-definition index), assembles the document,
// stores its location, then on the render callback flips generation_state to
// `generated` (or `failed` with an error) and stamps status + headline counts.
// This file is never migrated from — see CLAUDE.md §5.3.

import {
  boolean,
  integer,
  pgSchema,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const reportRuns = baseout.table("report_runs", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text("space_id").notNull(),
  reportDefinitionId: text("report_definition_id").notNull(),
  // Half-open window [window_start, window_end).
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  // Manual window override; does not advance the since_last chain.
  adHoc: boolean("ad_hoc").notNull().default(false),
  triggerKind: text("trigger_kind").notNull(), // 'scheduled' | 'manual'
  triggerBy: text("trigger_by"), // snapshot of member/schedule name
  generationState: text("generation_state").notNull().default("running"),
  // 'running' | 'generated' | 'failed'
  status: text("status"), // 'healthy' | 'issues' | 'failed' (NULL until generated)
  backupsOk: integer("backups_ok").notNull().default(0),
  backupsFailed: integer("backups_failed").notNull().default(0),
  documentLocation: text("document_location"),
  artifactPdfLocation: text("artifact_pdf_location"),
  artifactHtmlLocation: text("artifact_html_location"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
});

export type ReportRunRow = typeof reportRuns.$inferSelect;
