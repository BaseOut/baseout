/**
 * Schema barrel — re-exports all table definitions.
 *
 * The Drizzle runtime client imports from here to get typed access to ALL tables
 * (auth + core). The drizzle.config.ts points at core.ts only so drizzle-kit
 * migrations ignore Better Auth's tables.
 */

export * from './auth'
export * from './core'
