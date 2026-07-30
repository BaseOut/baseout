/**
 * Better Auth `twoFactor` plugin table (web-auth-2fa).
 *
 * Web-owned migration (apps/web/drizzle/0032_two_factor.sql), generated to
 * match better-auth 1.6.x's twoFactor schema (model 'twoFactor' → plural
 * table 'two_factors' under the drizzle adapter's usePlural mapping).
 *
 * `secret` and `backup_codes` are DOUBLY encrypted at rest:
 *   1. better-auth's plugin-native symmetric encryption (BETTER_AUTH_SECRET)
 *   2. AES-256-GCM with the master key (BASEOUT_ENCRYPTION_KEY) applied by
 *      the adapter storage hook in src/lib/two-factor/encryption.ts —
 *      same at-rest posture as OAuth token *_enc columns (PRD §20.2).
 * Never select these columns into client-facing payloads.
 *
 * The companion `users.two_factor_enabled` column is added by the same
 * migration; its drizzle mapping lives in the adapter-only extended users
 * table in src/lib/two-factor/adapter-schema.ts (the canonical users table
 * in @baseout/db-schema is not modified — mirror rule).
 *
 * NO password columns anywhere — Baseout stays passwordless (CLAUDE.md §3.3);
 * TOTP is a second factor, not a credential.
 */

import { boolean, index, text } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { baseout, users } from './auth'

export const twoFactors = baseout.table('two_factors', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  /** Encrypted TOTP secret (see header — double encryption). */
  secret: text('secret').notNull(),
  /** Encrypted backup-code set (10 single-use codes, plugin-managed). */
  backupCodes: text('backup_codes').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** false until the user proves a live TOTP code (verify-to-activate). */
  verified: boolean('verified').notNull().default(false),
}, (table) => [
  index('two_factors_user_id_idx').on(table.userId),
])
