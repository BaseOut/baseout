// MIRROR of apps/web/src/db/schema/core.ts:991 (canonical writer).
// Migrations: apps/web/drizzle/0030_airtable_webhooks.sql
//
// Org-level Airtable webhook registry (server-instant-webhook Phase A).
// One row per (organization, base) — Airtable caps 2 webhooks per base per
// integration — with per-Space fan-out in airtable_webhook_subscriptions.
// `id` is pre-generated and embedded in the notificationUrl path (NOT
// Airtable's webhook id, which is airtable_webhook_id).
//
// apps/server registers/deletes webhooks (Phase E) and owns status flips +
// renewal stamps: the hourly renewal cron (server-cron-webhook-renewal)
// refreshes expiring rows (expires_at / last_renewed_at), re-enables rows
// Airtable muted (notifications_disabled → active), and surfaces dead
// registrations (pending_reauth). apps/hooks stamps last_ping_at on each
// Airtable ping.
//
// Columns the engine neither reads nor writes (createdAt,
// lastPingSourceIp — written by apps/hooks only) are intentionally omitted
// following the same pattern as connections.ts. Add columns when the engine
// actually needs them — never migrate from this side.
//
// Per CLAUDE.md §5.3.

import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const airtableWebhooks = baseout.table("airtable_webhooks", {
  // .default mirrors the canonical DB default (gen_random_uuid()) so the
  // Phase E find-or-create INSERT may omit `id` when it doesn't need to
  // pre-generate one. This file is never migrated from — see header.
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text("organization_id").notNull(),
  connectionId: text("connection_id").notNull(),
  // ^ the OAuth token that created the webhook (create/refresh/poll auth).
  baseId: text("base_id").notNull(), // Airtable app…
  airtableWebhookId: text("airtable_webhook_id").notNull(),
  macSecretBase64Enc: text("mac_secret_base64_enc").notNull(),
  // ^ AES-256-GCM ciphertext; Airtable returns the secret ONLY at create.
  status: text("status").notNull().default("active"),
  // 'active' | 'notifications_disabled' | 'pending_reauth' | 'inactive'
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastPingAt: timestamp("last_ping_at", { withTimezone: true }),
  // ^ written by apps/hooks; read by the SpaceDO dirty-check.
  lastRenewedAt: timestamp("last_renewed_at", { withTimezone: true }),
  // ^ written by the renewal cron (server-cron-webhook-renewal).
  modifiedAt: timestamp("modified_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // .defaultNow() mirrors the canonical DB default so engine INSERTs can
  // omit modified_at. This file is never migrated from — see header.
});

export type AirtableWebhookRow = typeof airtableWebhooks.$inferSelect;
