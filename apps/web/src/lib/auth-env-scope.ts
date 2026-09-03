/**
 * Env-scoping storage hook for the better-auth adapter
 * (shared-org-runtime-env, design D3 second amendment — Dan 2026-09-01).
 *
 * `users` is unique on (email, runtime_env): the same address exists as a
 * SEPARATE user row per environment, inheriting its env from the account
 * (Organization) side of the split. better-auth addresses users by email in
 * the magic-link and SSO flows, so without scoping it would resolve an
 * arbitrary env's row. This wrapper appends `runtimeEnv = <worker env>` to
 * every email-addressed `user` query at the adapter boundary — the same
 * transparent-wrapper pattern as two-factor/encryption.ts.
 *
 * Id-addressed lookups (sessions → user) pass through untouched: ids are
 * globally unique and the middleware's session env check still applies.
 * A null/unknown worker env scopes to a match-nothing sentinel (fail closed,
 * mirroring the engine's scopedRuntimeEnv). Creates are not touched here —
 * `databaseHooks.user.create.before` stamps runtimeEnv.
 */

import type { OrgRuntimeEnv } from './runtime-env'

const USER_MODEL = 'user'
const SCOPED_METHODS = new Set([
  'findOne',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
])

export interface AdapterWhereClause {
  field: string
  value?: unknown
  operator?: string
  connector?: string
}

interface AdapterCallArgs extends Record<string, unknown> {
  model?: string
  where?: AdapterWhereClause[]
}

function scopeWhere(
  callArgs: AdapterCallArgs,
  workerEnv: OrgRuntimeEnv | null,
): AdapterCallArgs {
  if (callArgs?.model !== USER_MODEL) return callArgs
  const where = callArgs.where
  if (!Array.isArray(where)) return callArgs
  if (!where.some((w) => w?.field === 'email')) return callArgs
  if (where.some((w) => w?.field === 'runtimeEnv')) return callArgs
  return {
    ...callArgs,
    where: [
      ...where,
      {
        field: 'runtimeEnv',
        // '__none__' matches no row — unknown env must never resolve a user.
        value: workerEnv ?? '__none__',
        operator: 'eq',
        connector: 'AND',
      },
    ],
  }
}

/**
 * Wrap a better-auth adapter FACTORY (e.g. `drizzleAdapter(db, cfg)`, or the
 * two-factor wrapper's output) so email-addressed `user` queries are scoped
 * to this worker's runtime env.
 */
export function withUserEnvScope<F extends (...args: never[]) => unknown>(
  createAdapter: F,
  workerEnv: OrgRuntimeEnv | null,
): F {
  const wrapped = ((...args: never[]) => {
    const adapter = createAdapter(...args) as Record<string, unknown>
    return new Proxy(adapter, {
      get(target, prop, receiver) {
        const original = Reflect.get(target, prop, receiver)
        if (typeof original !== 'function') return original
        if (typeof prop !== 'string' || !SCOPED_METHODS.has(prop)) {
          return (original as (...a: unknown[]) => unknown).bind(target)
        }
        return (callArgs: AdapterCallArgs, ...rest: unknown[]) =>
          (original as (...a: unknown[]) => unknown).call(
            target,
            scopeWhere(callArgs, workerEnv),
            ...rest,
          )
      },
    })
  }) as F
  return wrapped
}
