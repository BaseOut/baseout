/**
 * Better Auth — Read-only Drizzle table references
 *
 * These tables are created via Drizzle Kit migrations in the 'baseout' schema.
 * Better Auth uses the Drizzle adapter for runtime operations.
 *
 * Core auth only (no org plugin) — 4 tables:
 *   users, sessions, accounts, verifications
 *
 * All IDs are text with gen_random_uuid() — Better Auth's default.
 * Timestamps use updated_at (BA convention), not modified_at (Baseout convention).
 */

import {
  boolean,
  index,
  pgSchema,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const baseout = pgSchema('baseout')

// ———————————————————————————————————————————————————————————————————————————
// USERS
// Core user identity managed by Better Auth.
// ———————————————————————————————————————————————————————————————————————————

export const users = baseout.table('users', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  // Populated during onboarding as `${firstName} ${lastName}`; Better Auth
  // writes email into this column on initial user creation (magic-link signup).
  firstName: text('first_name'),
  lastName: text('last_name'),
  jobTitle: text('job_title'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  role: text('role').notNull().default('customer'),
  // 'customer' | 'super' — 'super' granted via auth-factory databaseHooks for
  // @openside.com staff; gates /ops console (see middleware.applyOpsGate).
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  marketingOptInAt: timestamp('marketing_opt_in_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (table) => [
  index('users_role_idx').on(table.role),
])

// ———————————————————————————————————————————————————————————————————————————
// SESSIONS
// Active login sessions.
// ———————————————————————————————————————————————————————————————————————————

export const sessions = baseout.table('sessions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
])

// ———————————————————————————————————————————————————————————————————————————
// ACCOUNTS
// OAuth / credential identity providers linked to users (for LOGIN, not data access).
// Better Auth 1.6.x calls this model "account" — table name "accounts" with plural config.
// ———————————————————————————————————————————————————————————————————————————

export const accounts = baseout.table('accounts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (table) => [
  index('accounts_user_id_idx').on(table.userId),
])

// ———————————————————————————————————————————————————————————————————————————
// VERIFICATIONS
// Email / magic link verification tokens.
// ———————————————————————————————————————————————————————————————————————————

export const verifications = baseout.table('verifications', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})
