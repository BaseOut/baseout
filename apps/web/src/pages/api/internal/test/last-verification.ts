/**
 * GET /api/internal/test/last-verification?email=<addr>
 *
 * DEV/TEST-ONLY: returns the most recent unconsumed magic-link verification
 * token for a sandboxed test email. Used by the Playwright tracer to skip the
 * email round-trip without provisioning an inbox.
 *
 * Three independent guards. Disabling one does NOT expose the endpoint;
 * accidental misconfiguration in prod requires *all three* to silently flip:
 *
 *   1. Build-time gate: E2E_TEST_MODE === 'true' Worker var. Set ONLY in the
 *      dev wrangler vars block. Without it, middleware does not bypass the
 *      route → caller hits the auth wall and gets 401 (route effectively
 *      doesn't exist for unauth callers). This handler additionally returns
 *      403 if it is somehow reached without the var.
 *   2. Request-time gate: X-E2E-Test-Auth header must HMAC-SHA-256 match the
 *      E2E_TEST_TOKEN Worker secret over the email value (base64-encoded).
 *      Compared with timingSafeEqual.
 *   3. Input gate: email must match /^e2e-[a-z0-9-]+@[a-z0-9.-]+$/. Refuses
 *      to return tokens for real user emails even if everything else is
 *      misconfigured.
 *
 * Security notes:
 *   - Read-only. Never mutates verifications.
 *   - Never returns tokens for emails that don't match the e2e- prefix.
 *   - Never returns expired tokens.
 *   - 401 / 403 / 400 / 404 reveal nothing about whether a token exists.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, desc, gt, like } from 'drizzle-orm'
import { verifications } from '../../../../db/schema'

// e2e- prefix + restricted character set blocks LIKE wildcards (% / _) and
// quote characters. Must stay tight — relaxing this widens the input gate.
const E2E_EMAIL_PATTERN = /^e2e-[a-z0-9-]+@[a-z0-9.-]+$/

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function forbidden(): Response {
  return new Response(JSON.stringify({ error: 'forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

function badRequest(): Response {
  return new Response(JSON.stringify({ error: 'bad_request' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

function notFound(): Response {
  return new Response(JSON.stringify({ error: 'not_found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
}

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

export const GET: APIRoute = async ({ url, request, locals }) => {
  const workerEnv = env as unknown as {
    E2E_TEST_MODE?: string
    E2E_TEST_TOKEN?: string
  }

  // Guard 1: build-time gate. Defense in depth — middleware should already
  // have refused to bypass the auth wall without this var.
  if (workerEnv.E2E_TEST_MODE !== 'true') {
    return forbidden()
  }

  const secret = workerEnv.E2E_TEST_TOKEN
  if (!secret) {
    return forbidden()
  }

  // Guard 3 (run before HMAC to avoid HMAC-validating malformed input).
  const email = url.searchParams.get('email')
  if (!email || !E2E_EMAIL_PATTERN.test(email)) {
    return badRequest()
  }

  // Guard 2: HMAC over the email value, base64-encoded, in X-E2E-Test-Auth.
  const presented = request.headers.get('x-e2e-test-auth')
  if (!presented) return unauthorized()
  if (!verifyHmac(secret, email, presented)) return unauthorized()

  // value is JSON-encoded { email, name, attempt } — see better-auth magic-link
  // plugin. The e2e- prefix + restricted regex above blocks LIKE wildcards.
  const rows = await locals.db
    .select({
      token: verifications.identifier,
      value: verifications.value,
      expiresAt: verifications.expiresAt,
      createdAt: verifications.createdAt,
    })
    .from(verifications)
    .where(
      and(
        like(verifications.value, `%"email":"${email}"%`),
        gt(verifications.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(verifications.createdAt))
    .limit(1)

  const row = rows[0]
  if (!row) return notFound()

  return new Response(
    JSON.stringify({
      token: row.token,
      email,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}
