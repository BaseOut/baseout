export const ORG_RUNTIME_ENVS = ["dev", "staging", "production"] as const;

export type OrgRuntimeEnv = (typeof ORG_RUNTIME_ENVS)[number];

export function isOrgRuntimeEnv(
  value: string | undefined,
): value is OrgRuntimeEnv {
  return (ORG_RUNTIME_ENVS as readonly string[]).includes(value ?? "");
}

/** Worker env this process is allowed to operate on. Null = fail closed. */
export function resolveRuntimeEnv(vars: {
  BASEOUT_ENV?: string;
  BASEOUT_DEV?: string;
}): OrgRuntimeEnv | null {
  if (isOrgRuntimeEnv(vars.BASEOUT_ENV)) return vars.BASEOUT_ENV;
  if (vars.BASEOUT_DEV === "true") return "dev";
  return null;
}

/** SQL scope: unknown Worker env matches no Organization row. */
export function workerOrgScope(vars: {
  BASEOUT_ENV?: string;
  BASEOUT_DEV?: string;
}): string {
  return resolveRuntimeEnv(vars) ?? "__none__";
}

export function matchesScopedEnv(
  rowRuntimeEnv: string | null | undefined,
  workerEnv: OrgRuntimeEnv | null,
): boolean {
  if (!workerEnv) return false;
  return rowRuntimeEnv === workerEnv;
}

/**
 * Keep a listing row only when its Organization env matches this Worker.
 * Used by unit tests for cron filters (design D8) and as the in-memory
 * equivalent of `organizations.runtime_env = workerOrgScope(env)`.
 */
export function selectRowsForWorkerEnv<T extends { runtimeEnv: string }>(
  rows: T[],
  workerEnv: OrgRuntimeEnv | null,
): T[] {
  const scope = workerEnv ?? "__none__";
  return rows.filter((row) => row.runtimeEnv === scope);
}

export function productionLockoutEvent(input: {
  resolvedEnv: OrgRuntimeEnv | null;
  organizationCount: number;
  productionTaggedCount: number;
}): {
  event: "production_runtime_env_lockout";
  organizationCount: number;
  productionTaggedCount: number;
} | null {
  if (input.resolvedEnv !== "production") return null;
  if (input.organizationCount === 0) return null;
  if (input.productionTaggedCount > 0) return null;
  return {
    event: "production_runtime_env_lockout",
    organizationCount: input.organizationCount,
    productionTaggedCount: 0,
  };
}
