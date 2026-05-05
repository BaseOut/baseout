/**
 * Openside staff identity — Drizzle table definitions.
 *
 * All tables live in the `openside_identity` Postgres schema. The DB itself
 * is named `openside_identity_<env>` per env (one cluster, one DB per env);
 * a single staff_user_id is replicated across envs by the onboarding script
 * so cross-env grants resolve to the same human.
 *
 * The four BetterAuth tables (users / sessions / accounts / verifications)
 * follow the exact column shape baseout-starter uses for customer auth so
 * the BetterAuth Drizzle adapter works without custom mappings. They are
 * exported with a `staff*` prefix so consumers that connect to BOTH the
 * baseout-master DB and the openside-identity DB can disambiguate.
 *
 * staffRoleGrants enforces the (user × role × product × environment) RBAC
 * model — a single human's access is a set of grants, each scoped to one
 * (product, env) tuple or wildcards thereof.
 */

import {
  index,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const opensideIdentity = pgSchema('openside_identity')

// ———————————————————————————————————————————————————————————————————————————
// STAFF USERS  (BetterAuth: users)
// One row per Openside human, ever. Same id replicated across envs by the
// onboarding script so a grant lookup in any env resolves to the same row.
// ———————————————————————————————————————————————————————————————————————————

export const staffUsers = opensideIdentity.table('users', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: text('email_verified').notNull().default('false'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

// ———————————————————————————————————————————————————————————————————————————
// STAFF SESSIONS  (BetterAuth: sessions)
// Per-env: each env has a different BETTER_AUTH_SECRET so a session minted
// in dev cannot be replayed in staging or prod even though the user_id is
// the same row.
// ———————————————————————————————————————————————————————————————————————————

export const staffSessions = opensideIdentity.table(
  'sessions',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
  },
  (table) => [index('staff_sessions_user_id_idx').on(table.userId)],
)

// ———————————————————————————————————————————————————————————————————————————
// STAFF ACCOUNTS  (BetterAuth: accounts)
// Required by BetterAuth's Drizzle adapter even when only magic-link is in
// use. Empty for staff in V1.
// ———————————————————————————————————————————————————————————————————————————

export const staffAccounts = opensideIdentity.table(
  'accounts',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('staff_accounts_user_id_idx').on(table.userId)],
)

// ———————————————————————————————————————————————————————————————————————————
// STAFF VERIFICATIONS  (BetterAuth: verifications)
// Magic-link tokens. TTL ~5min per BetterAuth defaults.
// ———————————————————————————————————————————————————————————————————————————

export const staffVerifications = opensideIdentity.table('verifications', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

// ———————————————————————————————————————————————————————————————————————————
// STAFF ROLE GRANTS
// The RBAC core. A staff user has zero-or-more grants. A grant is the tuple
// (role, product, environment). Wildcards: product='*' matches every Openside
// product; environment='*' matches every env. role is one of the StaffRole
// values defined in ./types.
//
// Authorization is "find any grant matching (current product, current env)
// that hasn't expired." A super-admin has (role='super', product='*',
// environment='*'). All other grants are explicit.
//
// Composite uniqueness on (user_id, role, product, environment) prevents
// duplicate grants for the same scope; an attempt to re-grant is a no-op.
// ———————————————————————————————————————————————————————————————————————————

export const staffRoleGrants = opensideIdentity.table(
  'role_grants',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    product: text('product').notNull(),
    environment: text('environment').notNull(),
    grantedBy: text('granted_by').references(() => staffUsers.id, {
      onDelete: 'set null',
    }),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('staff_role_grants_unique').on(
      table.userId,
      table.role,
      table.product,
      table.environment,
    ),
    index('staff_role_grants_user_id_idx').on(table.userId),
    index('staff_role_grants_lookup_idx').on(
      table.userId,
      table.product,
      table.environment,
    ),
  ],
)

// ———————————————————————————————————————————————————————————————————————————
// STAFF AUDIT LOG
// Append-only record of staff actions: sign-ins, grant changes, ops actions.
// Critical for SOC 2 down the road; we add it now because retro-fitting
// audit hooks across an established codebase is far harder than starting
// with the table.
// ———————————————————————————————————————————————————————————————————————————

export const staffAuditLog = opensideIdentity.table(
  'audit_log',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: text('user_id').references(() => staffUsers.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    target: text('target'),
    metadata: jsonb('metadata'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('staff_audit_log_user_id_idx').on(table.userId),
    index('staff_audit_log_created_at_idx').on(table.createdAt),
  ],
)
