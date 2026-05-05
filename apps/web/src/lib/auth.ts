/**
 * Better Auth — per-request factory for the Astro/workerd runtime.
 *
 * The middleware builds a fresh `auth` instance per request, bound to the
 * per-request `db` and the request-scoped env (EMAIL binding, EMAIL_FROM,
 * BETTER_AUTH_SECRET). The base URL is resolved per-request by Better Auth
 * from the Host header — see `AUTH_BASE_URL` in `auth-factory.ts`.
 * Module-scoped auth is unsafe in workerd because the underlying
 * postgres-js sockets cannot cross request boundaries.
 *
 * Node tooling (seed, scripts) should build its own instance by passing
 * the Node-side `db` from `src/db/node.ts` to `createAuth()` directly.
 */

import type { AppDb } from '../db'
import { createAuth, type AuthFactoryEnv } from './auth-factory'

export function createAppAuth(db: AppDb, env: AuthFactoryEnv) {
  return createAuth(db, env)
}

export type AppAuth = ReturnType<typeof createAppAuth>
