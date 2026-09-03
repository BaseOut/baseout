export const ORG_RUNTIME_ENVS = ['dev', 'staging', 'production'] as const

export type OrgRuntimeEnv = (typeof ORG_RUNTIME_ENVS)[number]

export function isOrgRuntimeEnv(value: string | undefined): value is OrgRuntimeEnv {
  return ORG_RUNTIME_ENVS.includes(value as OrgRuntimeEnv)
}

/** Worker env this process is allowed to operate on. Null = fail closed. */
export function resolveRuntimeEnv(vars: {
  BASEOUT_ENV?: string
  BASEOUT_DEV?: string
}): OrgRuntimeEnv | null {
  if (isOrgRuntimeEnv(vars.BASEOUT_ENV)) return vars.BASEOUT_ENV
  if (vars.BASEOUT_DEV === 'true') return 'dev'
  return null
}

/** Stamp `users.runtime_env` at insert. Empty when the Worker env is unknown. */
export function userCreateRuntimeEnvFields(
  workerEnv: OrgRuntimeEnv | null,
): { runtimeEnv?: OrgRuntimeEnv } {
  return workerEnv ? { runtimeEnv: workerEnv } : {}
}

/**
 * Session whose user env ≠ this Worker is treated as unauthenticated.
 * D3 second amendment: no per-email exemptions — the same address is a
 * SEPARATE user row per env (unique(email, runtime_env)); auth lookups are
 * env-scoped at the adapter boundary (auth-env-scope.ts), so a mismatched
 * session should be impossible — this stays as defense-in-depth.
 */
export function sessionMatchesWorkerEnv(
  userRuntimeEnv: string | null | undefined,
  workerEnv: OrgRuntimeEnv | null,
): boolean {
  if (!workerEnv) return false
  return userRuntimeEnv === workerEnv
}

/**
 * Membership + env: an other-env Organization is not writable even if the
 * user is a member (design D10).
 */
export function organizationIsWritableForEnv(input: {
  isMember: boolean
  orgRuntimeEnv: string | null | undefined
  workerEnv: OrgRuntimeEnv | null
}): boolean {
  if (!input.isMember) return false
  if (!input.workerEnv) return false
  return input.orgRuntimeEnv === input.workerEnv
}

/**
 * Production lockout tripwire (design D7). Fires when this Worker is
 * production, the organizations table is non-empty, and zero rows are tagged
 * production — the 0040 DEFAULT 'staging' landmine on the separate prod DB.
 */
export function productionLockoutEvent(input: {
  resolvedEnv: OrgRuntimeEnv | null
  organizationCount: number
  productionTaggedCount: number
}): {
  event: 'production_runtime_env_lockout'
  organizationCount: number
  productionTaggedCount: number
} | null {
  if (input.resolvedEnv !== 'production') return null
  if (input.organizationCount === 0) return null
  if (input.productionTaggedCount > 0) return null
  return {
    event: 'production_runtime_env_lockout',
    organizationCount: input.organizationCount,
    productionTaggedCount: 0,
  }
}
