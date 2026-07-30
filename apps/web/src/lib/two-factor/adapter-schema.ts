/**
 * Adapter-only extended `users` table (web-auth-2fa).
 *
 * The better-auth `twoFactor` plugin reads/writes `user.twoFactorEnabled`,
 * so the drizzle adapter needs a users table object that maps that column.
 * The CANONICAL users definition lives in @baseout/db-schema (not modified
 * by this change — package is outside apps/web's blast radius); this file
 * is a field-for-field mirror plus `two_factor_enabled`, passed ONLY to the
 * drizzle adapter's `schema` option in auth-factory.ts.
 *
 * Deliberately NOT exported from src/db/schema/index.ts and NOT listed in
 * drizzle.config.ts — a second 'users' table there would break drizzle-kit.
 * The column itself is created by drizzle/0032_two_factor.sql.
 *
 * If @baseout/db-schema's users table changes, update this mirror (header
 * rule, CLAUDE.md §2 mirror convention).
 */

import { boolean, index, text, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { baseout } from '../../db/schema/auth'

export const usersWithTwoFactor = baseout.table('users', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  jobTitle: text('job_title'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  role: text('role').notNull().default('customer'),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  marketingOptInAt: timestamp('marketing_opt_in_at', { withTimezone: true }),
  // web-auth-2fa: the twoFactor plugin's user flag (migration 0032).
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (table) => [
  index('users_role_idx').on(table.role),
])
