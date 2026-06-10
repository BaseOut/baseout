// MIRROR of apps/web/src/db/schema/core.ts:attachmentDedup (canonical writer).
// Canonical migration:
//   apps/web/drizzle/0013_attachment_dedup.sql
//
// Filed by openspec/changes/server-attachments. Per CLAUDE.md §2, master-DB
// schema is owned by apps/web. This mirror exists because the engine serves
// the dedup-lookup/upsert endpoint that the workflows attachment downloader
// hits (POST /api/internal/attachments/lookup) — workflows is Node-only and
// reaches the master DB only through the engine's INTERNAL_TOKEN-gated routes.
//
// `storage_key` is destination-agnostic (R2 object key | BYOS relative path |
// local-disk relative path) — the same string the StorageWriter writes to.

import { bigint, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const attachmentDedup = baseout.table("attachment_dedup", {
  // {base_id}_{table_id}_{record_id}_{field_id}_{attachment_id} per PRD §2.8.
  compositeId: text("composite_id").primaryKey(),
  spaceId: text("space_id").notNull(),
  storageKey: text("storage_key").notNull(),
  contentHash: text("content_hash"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  mimeType: text("mime_type"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AttachmentDedupRow = typeof attachmentDedup.$inferSelect;
