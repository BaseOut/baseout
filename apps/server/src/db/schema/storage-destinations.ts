// MIRROR of apps/web/src/db/schema/core.ts:storageDestinations (canonical writer).
// Canonical migration: apps/web/drizzle/0009_storage_destinations.sql.
//
// Filed by openspec/changes/shared-byos-drive. Per CLAUDE.md §2, master-DB
// schema is owned by apps/web. This mirror exists only because the engine
// reads + lazy-refreshes the encrypted OAuth tokens on behalf of workflows
// (which is Node-only and cannot hold the master encryption key).
//
// Engine surface:
// - GET /api/internal/spaces/:spaceId/storage-destination — reads, decrypts,
//   conditionally refreshes the access token (proactive: < 5 min to expiry;
//   on-demand: ?refresh=1), persists the refreshed access_token + expires_at
//   back, returns plaintext access_token + provider_folder_id to workflows.
// - The engine NEVER returns the refresh token to workflows.
//
// Columns the engine doesn't need (provider_account_id, oauth_account_email
// for audit-only reads) are still mirrored so SELECT * binding stays stable
// across releases. Add columns when canonical migrations widen the row.

import {
  pgSchema,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const storageDestinations = baseout.table("storage_destinations", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text("space_id").notNull(),
  type: text("type").notNull(),
  // 'local_fs' | 'google_drive' — CHECK enforced canonically;
  // widens additively when subsequent BYOS providers land.
  oauthAccessTokenEnc: text("oauth_access_token_enc"),
  oauthRefreshTokenEnc: text("oauth_refresh_token_enc"),
  oauthExpiresAt: timestamp("oauth_expires_at", { withTimezone: true }),
  oauthScope: text("oauth_scope"),
  oauthAccountEmail: text("oauth_account_email"),
  providerFolderId: text("provider_folder_id"),
  providerAccountId: text("provider_account_id"),
  connectedByUserId: text("connected_by_user_id"),
  connectedAt: timestamp("connected_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
});

export type StorageDestinationRow = typeof storageDestinations.$inferSelect;
