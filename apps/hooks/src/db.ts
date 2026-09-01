// Master-DB access for apps/hooks — one registry table, per-request client.
//
// MIRROR of apps/web/src/db/schema/core.ts `airtableWebhooks` (canonical
// writer; migration db/migrations/0030_airtable_webhooks.sql). Never
// migrate from this side. Only the columns the receiver touches — same
// local-mirror convention as apps/api/src/db/schema.ts (the "publish via
// @baseout/db-schema" wording in server-instant-webhook A.5 is superseded by
// this precedent).
//
// Per-request postgres-js (workerd forbids cross-request I/O reuse); deployed
// envs go through HYPERDRIVE, local dev through the Hyperdrive simulator
// (scripts/dev.mjs), matching apps/api.

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import postgres, { type Sql } from "postgres";
import type { Env } from "./env";

const baseout = pgSchema("baseout");

export const airtableWebhooks = baseout.table("airtable_webhooks", {
  id: text("id").primaryKey(),
  baseId: text("base_id").notNull(),
  airtableWebhookId: text("airtable_webhook_id").notNull(),
  macSecretBase64Enc: text("mac_secret_base64_enc").notNull(),
  status: text("status").notNull(),
  lastPingAt: timestamp("last_ping_at", { withTimezone: true }),
  lastPingSourceIp: text("last_ping_source_ip"),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull(),
});

const schema = { airtableWebhooks };
export type HooksDb = PostgresJsDatabase<typeof schema>;

export function createMasterDb(env: Env): { db: HooksDb; sql: Sql } {
  const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!url) throw new Error("Master DB URL not configured (HYPERDRIVE or DATABASE_URL).");
  const sql = postgres(url, {
    prepare: false,
    max: 1,
    connection: { search_path: "baseout,public" },
  });
  return { db: drizzle(sql, { schema }), sql };
}
