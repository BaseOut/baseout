/**
 * Shim — the actual Better Auth Drizzle table definitions and the shared
 * `baseout` pgSchema now live in `@baseout/db-schema/schema/auth.ts`. This
 * file re-exports them so existing consumers (core.ts, the barrel, profile
 * page, last-verification test route, drizzle.config.ts) keep their import
 * paths unchanged. First slice of the `system-db-schema` Phase 1 extraction
 * (see openspec/changes/system-db-schema/proposal.md).
 *
 * When the rest of Phase 1 lands and core.ts also imports from the package
 * directly, this shim can be deleted.
 */

export { baseout, users, sessions, accounts, verifications } from '@baseout/db-schema'
