// MIRROR of apps/web/src/db/schema/core.ts (canonical writer — `spaceDatabases`).
// Migration: apps/web/drizzle/0017_young_valeria_richards.sql
//
// apps/web INSERTs the row at Space creation (status='pending') via the engine
// provisioning route; apps/server (this Worker) owns the per-Space DB lifecycle:
// it upserts the row through provisioning ('pending' → 'provisioning' →
// 'active' | 'error'), records the backend locator (pg_locator for managed_pg,
// d1_database_id for d1, byodb_connection_string_enc for byodb), schema_version,
// and error_message. Never migrate from this side — see CLAUDE.md §5.3 / §2.
//
// Cross-DB note: this row is master-DB control-plane state; the per-Space DB it
// points at holds the bo_at_* tables (@baseout/db-schema/space).

import { boolean, integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const spaceDatabases = baseout.table("space_databases", {
  // .default mirrors the canonical DB default so the engine can omit `id` on
  // an upsert insert. This file is never migrated from — see header.
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text("space_id").notNull(),
  backend: text("backend").notNull(), // 'd1' | 'managed_pg' | 'byodb'
  recordsEnabled: boolean("records_enabled").notNull().default(false),
  status: text("status").notNull().default("pending"),
  // 'pending' | 'provisioning' | 'active' | 'migrating' | 'error'
  d1DatabaseId: text("d1_database_id"),
  pgLocator: text("pg_locator"),
  byodbConnectionStringEnc: text("byodb_connection_string_enc"),
  schemaVersion: integer("schema_version"),
  lastSchemaSyncAt: timestamp("last_schema_sync_at", { withTimezone: true }),
  lastRecordsSyncAt: timestamp("last_records_sync_at", { withTimezone: true }),
  provisionedByUserId: text("provisioned_by_user_id"),
  provisionedAt: timestamp("provisioned_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SpaceDatabaseRow = typeof spaceDatabases.$inferSelect;
