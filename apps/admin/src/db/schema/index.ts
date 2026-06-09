// Schema barrel for the admin per-request Drizzle client.
//
// Auth tables (`users`, `sessions`) come from @baseout/db-schema — the shared,
// canonical source for Better Auth tables. Operational tables are mirrored from
// apps/web/src/db/schema/core.ts (see ./core.ts header).
export { users, sessions } from '@baseout/db-schema'
export * from './core'
