// MIRROR of apps/web/src/db/schema/core.ts:499 (canonical writer).
// Canonical source: apps/web/drizzle/0010_storage_destinations.sql.
// CHECK constraint widened by 0013 (box) + 0014 (local_fs) — see
// openspec/changes/shared-byos-box + system-local-fs-dev-writer.
//
// apps/web writes storage_destinations during the OAuth Connect flow (per
// space: one row, scoped by `space_id` UNIQUE). apps/server reads the row +
// decrypts oauth_access_token_enc / oauth_refresh_token_enc in the engine
// internal route POST /api/internal/spaces/:id/storage-destination, lazily
// refreshes the access token when it's <5 minutes from expiry, persists
// the refreshed tokens back, and returns the destination handle to the
// workflows runner. apps/server also INSERTs auto-provisioned 'local_fs'
// rows from apps/server/src/lib/runs/start.ts when a Space has no
// OAuth-connected BYOS row — same pattern as the backup_runs mirror,
// hence the gen_random_uuid() default on `id`.
//
// Per CLAUDE.md §5.3.

import { sql } from "drizzle-orm";
import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const storageDestinations = baseout.table("storage_destinations", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text("space_id").notNull(),
  type: text("type").notNull(),
  // 'r2_managed' | 'google_drive' | 'dropbox' | 'box' | 'local_fs' — DB CHECK
  // constraint enforced in the canonical migration. 'local_fs' is a
  // dev-runner-only destination auto-provisioned in apps/server/src/lib/runs/
  // start.ts when a Space has no OAuth-connected BYOS row; see openspec/
  // changes/system-local-fs-dev-writer.
  oauthAccessTokenEnc: text("oauth_access_token_enc"),
  oauthRefreshTokenEnc: text("oauth_refresh_token_enc"),
  oauthExpiresAt: timestamp("oauth_expires_at", { withTimezone: true }),
  oauthScope: text("oauth_scope"),
  oauthAccountEmail: text("oauth_account_email"),
  providerFolderId: text("provider_folder_id"),
  providerAccountId: text("provider_account_id"),
  connectedByUserId: text("connected_by_user_id"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  // createdAt / modifiedAt omitted — engine doesn't read them.
});

export type StorageDestinationRow = typeof storageDestinations.$inferSelect;
