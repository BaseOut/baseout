// MIRROR of apps/web/src/db/schema/core.ts (reportDeliveries — canonical writer).
// Migration: db/migrations/0038_reports.sql
//
// One row per recipient per rendered report, powering the UI's expandable
// failure list + re-send. apps/web owns the migration; apps/server is the sole
// writer: on the render callback it INSERTs a row per recipient/format and flips
// status to `sent` | `failed` (with error) as the EMAIL binding reports back.
// This file is never migrated from — see CLAUDE.md §5.3.

import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const reportDeliveries = baseout.table("report_deliveries", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  reportRunId: text("report_run_id").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientKind: text("recipient_kind").notNull(), // 'member' | 'external'
  format: text("format").notNull(), // 'pdf' | 'html'
  status: text("status").notNull().default("pending"), // 'pending' | 'sent' | 'failed'
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReportDeliveryRow = typeof reportDeliveries.$inferSelect;
