// MIRROR of apps/web/src/db/schema/ai-provider-keys.ts (canonical writer).
// Migration: db/migrations/0036_ai_provider_keys.sql. Never migrate from this
// side — see CLAUDE.md §5.3 / §2.
//
// apps/web owns the write path (persistProviderKey encrypts the key). This engine
// mirror is READ-ONLY: the AI-routing seam reads the active key's facts
// (provider, model_default) and the credential-fetch endpoint (task 3.3) reads
// key_enc to decrypt for the Node runner. Only the columns the engine reads are
// mirrored.

import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const aiProviderKeys = baseout.table("ai_provider_keys", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text("organization_id").notNull(),
  provider: text("provider").notNull(), // 'anthropic' | 'openai' | 'cloudflare'
  keyEnc: text("key_enc").notNull(), // AES-256-GCM ciphertext — decrypt only over the 3.3 endpoint
  modelDefault: text("model_default"),
  status: text("status").notNull().default("active"), // 'active' | 'invalid' | 'disabled'
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  validationError: text("validation_error"),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiProviderKeyRow = typeof aiProviderKeys.$inferSelect;
