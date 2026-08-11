/**
 * GET /api/internal/test/auth-config
 *
 * DEV/TEST-ONLY: reports the session-cookie mode the worker resolved from
 * `PUBLIC_AUTH_BASE_URL` — the exact inputs better-auth uses to decide the
 * session cookie's name (`better-auth.session_token` vs the `__Secure-`
 * prefixed variant) and its `Secure` attribute. Exists because cookie-mode
 * drift is invisible from the browser until sessions silently die (the
 * 2026-07-02 "Box connect bounces to /login" investigation needed exactly
 * this probe; see shared/internal/oauth-setup.md §8).
 *
 * Guard contract mirrors last-verification.ts (three independent gates):
 *   1. Build-time: E2E_TEST_MODE === 'true' Worker var (dev wrangler vars
 *      only). Middleware only bypasses /api/internal/test/* under the same
 *      var; this handler additionally 403s without it.
 *   2. Request-time: X-E2E-Test-Auth must HMAC-SHA-256 match the
 *      E2E_TEST_TOKEN Worker secret over the fixed payload "auth-config"
 *      (base64-encoded), compared with timingSafeEqual.
 *   3. Output is config-shape only — no secrets, tokens, or user data.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { resolveUseSecureCookies } from '../../../../lib/auth-factory'

export const AUTH_CONFIG_HMAC_PAYLOAD = 'auth-config'

export interface AuthConfigEnv {
  E2E_TEST_MODE?: string
  E2E_TEST_TOKEN?: string
  PUBLIC_AUTH_BASE_URL?: string
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Same shape as last-verification.ts — duplicated rather than extracted so
// this change doesn't touch that working route.
function verifyHmac(secret: string, payload: string, presented: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest()
  let provided: Buffer
  try {
    provided = Buffer.from(presented, 'base64')
  } catch {
    return false
  }
  if (provided.length !== expected.length) return false
  return timingSafeEqual(expected, provided)
}

export function handleGet(
  workerEnv: AuthConfigEnv,
  presentedAuth: string | null,
): Response {
  if (workerEnv.E2E_TEST_MODE !== 'true') {
    return json(403, { error: 'forbidden' })
  }
  const secret = workerEnv.E2E_TEST_TOKEN
  if (!secret) {
    return json(403, { error: 'forbidden' })
  }
  if (!presentedAuth) {
    return json(401, { error: 'unauthorized' })
  }
  if (!verifyHmac(secret, AUTH_CONFIG_HMAC_PAYLOAD, presentedAuth)) {
    return json(401, { error: 'unauthorized' })
  }

  const secure = resolveUseSecureCookies(workerEnv.PUBLIC_AUTH_BASE_URL)
  return json(200, {
    publicAuthBaseUrl: workerEnv.PUBLIC_AUTH_BASE_URL ?? null,
    secureCookies: secure === false ? 'off' : 'secure-default',
    sessionCookieName:
      secure === false
        ? 'better-auth.session_token'
        : '__Secure-better-auth.session_token',
  })
}

export const GET: APIRoute = async ({ request }) => {
  const workerEnv = env as unknown as AuthConfigEnv
  return handleGet(workerEnv, request.headers.get('x-e2e-test-auth'))
}
