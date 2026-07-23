// MIRROR of apps/web/src/db/schema/core.ts:1025 (canonical writer).
// Migrations: apps/web/drizzle/0030_airtable_webhooks.sql
//
// Per-Space fan-out of the org-level airtable_webhooks registry
// (server-instant-webhook Phase A): which Spaces consume a webhook, each with
// its own Airtable payload cursor (cursors start at 1) and polling watermark.
// last_polled_at answers "have I looked since the last ping?" — NOT
// processing success; the cursor tracks durable progress.
//
// apps/server owns the row lifecycle (Phase E register/unregister), the
// SpaceDO cadence poll stamps last_polled_at (Phase C), and the run plumbing
// advances payload_cursor monotonically / stamps last_reconciled_at on
// fallback (Phase D).
//
// Columns intentionally omitted: createdAt. Add when the engine actually
// reads it — never migrate from this side.
//
// Per CLAUDE.md §5.3.

import { bigint, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const airtableWebhookSubscriptions = baseout.table(
  "airtable_webhook_subscriptions",
  {
    // .default mirrors the canonical DB default (gen_random_uuid()) so the
    // Phase E subscription INSERT may omit `id`. Never migrated from — see
    // header.
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    webhookId: text("webhook_id").notNull(),
    spaceId: text("space_id").notNull(),
    payloadCursor: bigint("payload_cursor", { mode: "number" })
      .notNull()
      .default(1),
    // ^ Airtable payload cursors start at 1; advanced monotonically by the
    // Phase D cursor route (decreases rejected).
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true }),
    // ^ stamped by the Phase D fallback route; a poll sets reconcile=true in
    // the task payload when this is older than 7 days (Phase C).
    modifiedAt: timestamp("modified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // .defaultNow() mirrors the canonical DB default so engine INSERTs can
    // omit modified_at. Never migrated from — see header.
  },
);

export type AirtableWebhookSubscriptionRow =
  typeof airtableWebhookSubscriptions.$inferSelect;
