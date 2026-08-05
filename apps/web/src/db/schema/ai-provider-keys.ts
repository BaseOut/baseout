/**
 * Customer AI provider keys — the bring-your-own-key (BYOK) vault
 * (shared-ai-byok, design D1). Master DB, web-owned migration.
 *
 * One ACTIVE key per (Organization, provider). The key material is stored
 * AES-256-GCM-encrypted at rest in `key_enc` — the exact discipline OAuth
 * tokens follow (apps/web/src/lib/crypto.ts encryptToken; PRD §20.2). The
 * plaintext is WRITE-ONLY: never returned to the client, never logged, never
 * shown to staff — only `last_four` + `key_fingerprint` (SHA-256, irreversible)
 * are displayable.
 *
 * `provider`/`status` are text + CHECK constraints (the house enum idiom — see
 * addon_purchases / usage_notification_state in entitlements.ts) rather than a
 * pg native enum, so adding a provider is a data change, not a type migration.
 *
 * NOTE: the migration for this table is generated + applied in the migration
 * slice of shared-ai-byok (task 1.1) — this commit ships the DEFINITION only.
 * Generating requires adding this file to drizzle.config.ts `schema` (deferred
 * to avoid entangling concurrent uncommitted schema work in the tree).
 */

import { check, index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { baseout, users } from './auth'
import { organizations } from './core'

// Supported providers at launch (design D8). Kept in one place so the CHECK
// constraint and the routing seam's supported-provider set stay in step.
export const AI_PROVIDERS = ['anthropic', 'openai', 'cloudflare'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

// Key lifecycle states (design D5/D7). active → invalid (auth failure) →
// disabled (downgrade below Plus; not purged, so re-upgrade restores).
export const AI_PROVIDER_KEY_STATUSES = ['active', 'invalid', 'disabled'] as const
export type AiProviderKeyStatus = (typeof AI_PROVIDER_KEY_STATUSES)[number]

export const aiProviderKeys = baseout.table(
  'ai_provider_keys',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // AiProvider — see CHECK below
    // AES-256-GCM ciphertext (IV-prefixed base64), identical format to OAuth
    // `*_enc` columns. NEVER stored plaintext, NEVER returned by a read API.
    keyEnc: text('key_enc').notNull(),
    // SHA-256 hex of the plaintext — dedupe + "same key re-submitted" detection.
    // Irreversible; safe to store and compare, never the key itself.
    keyFingerprint: text('key_fingerprint').notNull(),
    lastFour: text('last_four').notNull(), // display only
    label: text('label'), // optional customer-facing label
    modelDefault: text('model_default'), // the customer's chosen model, nullable
    status: text('status').notNull().default('active'), // AiProviderKeyStatus
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
    validationError: text('validation_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'ai_provider_keys_provider_check',
      sql`${table.provider} in ('anthropic', 'openai', 'cloudflare')`,
    ),
    check(
      'ai_provider_keys_status_check',
      sql`${table.status} in ('active', 'invalid', 'disabled')`,
    ),
    // One ACTIVE key per (org, provider). Partial unique index so `invalid` /
    // `disabled` rows never collide with a fresh active key (rotation, re-upgrade).
    uniqueIndex('ai_provider_keys_org_provider_active_uq')
      .on(table.organizationId, table.provider)
      .where(sql`${table.status} = 'active'`),
    index('ai_provider_keys_org_idx').on(table.organizationId),
  ],
)
