// MIRROR of apps/web/src/db/schema/core.ts:196 (canonical writer).
//
// apps/web owns the connections table — its OAuth callback INSERTs/UPDATEs
// rows, and the master DB migrations are generated from apps/web/drizzle/.
// This mirror declares the columns the engine reads (id, status, the _enc
// tokens, expiry, scopes, platform_config, created_at — read by the
// SpaceDO scheduler in Phase B for `ORDER BY created_at DESC` recency)
// plus the columns the engine writes during the OAuth-refresh cron
// (status, *_enc tokens, expiry, scopes, modified_at, invalidated_at).
// Columns the engine neither reads nor writes (display_name, scope,
// space_id, max_concurrent_sessions, last_used_at, created_by_user_id)
// are intentionally omitted — the omission documents intent, and adding
// columns later is one line.
//
// Per CLAUDE.md §5.3: "apps/server mirrors specific tables… with header
// comments naming the canonical migration source." This file MUST NOT be
// migrated against — never `drizzle-kit push` from apps/server.

import { jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const connections = baseout.table("connections", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  platformId: text("platform_id").notNull(),
  status: text("status").notNull(),
  // Canonical status set: 'active' | 'invalid' | 'refreshing' | 'pending_reauth'
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  scopes: text("scopes"),
  platformConfig: jsonb("platform_config"),
  // airtable: { at_user_id, at_workspace_id, is_enterprise_scope }
  invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
  // set when the OAuth-refresh cron transitions a row to status='invalid'
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull(),
  // updated by the cron on every status transition; canonical default lives
  // in apps/web's migration.
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  // read by the SpaceDO scheduler (Phase B of
  // baseout-backup-schedule-and-cancel) to pick the most-recent active
  // Airtable connection per Org via `ORDER BY created_at DESC LIMIT 1`.
});

export type ConnectionRow = typeof connections.$inferSelect;
