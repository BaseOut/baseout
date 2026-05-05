/**
 * Openside staff identity — shared type unions.
 *
 * Roles, products, and environments are referenced by every Openside admin
 * surface for grant resolution. Centralizing them here ensures a new product
 * (e.g. osai-admin) and a new environment (e.g. canary) only requires one
 * change in one package.
 */

export const STAFF_ROLES = [
  'super',
  'admin',
  'engineer',
  'support',
  'billing',
] as const

export type StaffRole = (typeof STAFF_ROLES)[number]

export const OPENSIDE_PRODUCTS = ['baseout', 'osai', '*'] as const

export type OpensideProduct = (typeof OPENSIDE_PRODUCTS)[number]

export const ENVIRONMENTS = ['dev', 'staging', 'prod', '*'] as const

export type Environment = (typeof ENVIRONMENTS)[number]

/**
 * Email-domain allowlist for staff magic-link sign-up.
 *
 * Hard-coded here so every consumer applies the same gate without drift.
 * Update by PR + bump the package version when an additional Openside-owned
 * domain comes online.
 */
export const STAFF_EMAIL_DOMAIN_ALLOWLIST = ['openside.com'] as const

/**
 * The pattern matched against the email local-part to detect Openside staff.
 * Used by the JIT super-admin provisioning hook in BetterAuth.
 */
export const OPENSIDE_EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@openside\.com$/i
