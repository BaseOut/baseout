// MIRROR of apps/web/src/db/schema/core.ts `serviceRuns` (canonical writer of the
// migration). Migration: apps/web/drizzle/0028_service_runs.sql (shared-service-runs).
//
// Unlike most mirrors this one is WRITTEN by the engine — but only via the
// withServiceRun()/openServiceRun()/finalizeServiceRun() helpers in
// lib/service-runs.ts (INSERT a `started` row, UPDATE it to succeeded|failed).
// Never migrate from this side; web owns the migration.
//
// Per CLAUDE.md §5.3.

import { sql } from "drizzle-orm";
import { pgSchema, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const serviceRuns = baseout.table("service_runs", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  service: text("service").notNull(),
  status: text("status").notNull().default("started"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  counts: jsonb("counts"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ServiceRunRow = typeof serviceRuns.$inferSelect;
