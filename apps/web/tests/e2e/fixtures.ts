/**
 * Playwright fixtures for Baseout E2E.
 *
 * `inbox.getMagicLink(email)` polls the test-only endpoint
 * `/api/internal/test/last-verification` on the worker under test, fetches
 * the most recent unconsumed magic-link verification token for the given
 * email, and constructs the callback URL Playwright then navigates to.
 *
 * No real inbox is involved: the worker is run with E2E_TEST_MODE=true and
 * answers a small HMAC-authenticated query for the verifications table. See
 * src/pages/api/internal/test/last-verification.ts for the endpoint contract
 * and the three guards (build / request / input).
 *
 * Required env (set by .github/workflows/e2e-staging.yml):
 *   - E2E_TARGET_URL  : worker base URL (e.g. https://baseout-dev.openside.workers.dev)
 *   - E2E_TEST_TOKEN  : same secret that's set on the worker via `wrangler secret put`
 */

import { createHmac } from 'node:crypto'
import { test as base } from '@playwright/test'

export interface InboxFixture {
  /**
   * Polls the test-only verifications API for a fresh magic-link token
   * minted for `email` and returns a navigable verify URL.
   *
   * - Times out at `opts.timeoutMs` (default 60_000).
   * - Throws if no token arrives in time, or if the polling endpoint
   *   returns a status other than 200/404.
   * - Only accepts tokens with `createdAt` newer than the polling start
   *   time so a stale row left by a prior spec can't satisfy the wait.
   */
  getMagicLink(email: string, opts?: { timeoutMs?: number }): Promise<string>
}

interface VerificationResponse {
  token: string
  email: string
  expiresAt: string
  createdAt: string
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(
      `${name} is required for Playwright. CI sets it from secrets; for local ` +
        `runs export it before invoking \`npm run test:e2e\`.`,
    )
  }
  return v
}

function signEmail(secret: string, email: string): string {
  return createHmac('sha256', secret).update(email).digest('base64')
}

async function fetchVerification(
  baseUrl: string,
  secret: string,
  email: string,
): Promise<VerificationResponse | null> {
  const url = new URL('/api/internal/test/last-verification', baseUrl)
  url.searchParams.set('email', email)
  const res = await fetch(url, {
    headers: { 'X-E2E-Test-Auth': signEmail(secret, email) },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(
      `last-verification endpoint returned ${res.status}: ${await res.text()}`,
    )
  }
  return (await res.json()) as VerificationResponse
}

export const test = base.extend<{ inbox: InboxFixture }>({
  inbox: async ({}, use) => {
    const baseUrl = requireEnv('E2E_TARGET_URL')
    const secret = requireEnv('E2E_TEST_TOKEN')

    const inbox: InboxFixture = {
      async getMagicLink(email, opts) {
        const timeoutMs = opts?.timeoutMs ?? 60_000
        const startedAt = Date.now()
        const deadline = startedAt + timeoutMs
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const row = await fetchVerification(baseUrl, secret, email)
          if (row) {
            // Reject stale rows from previous specs/runs. createdAt comes
            // from Postgres so we tolerate a small clock skew window.
            if (new Date(row.createdAt).getTime() >= startedAt - 2_000) {
              const verify = new URL('/api/auth/magic-link/verify', baseUrl)
              verify.searchParams.set('token', row.token)
              verify.searchParams.set('callbackURL', '/')
              return verify.toString()
            }
          }
          if (Date.now() >= deadline) {
            throw new Error(
              `getMagicLink: no fresh token for ${email} within ${timeoutMs}ms`,
            )
          }
          await new Promise((r) => setTimeout(r, 1_000))
        }
      },
    }
    await use(inbox)
  },
})

export { expect } from '@playwright/test'
