/**
 * Tracer for PRD §14.5 critical-flow #1, second half:
 *   "...click Run backup now → backup run row appears in the dashboard widget"
 *
 * Scope of THIS spec (Phase 11 — Option A, minimal):
 *   - Seed an e2e-* user with full onboarding + active Airtable connection
 *     + one base selected (via /api/internal/test/seed-backup-happy-path).
 *   - Sign in via magic-link (reusing the existing fixture pattern).
 *   - Navigate to /integrations.
 *   - Click "Run backup now".
 *   - Assert the BackupHistoryWidget shows a fresh row with a non-terminal
 *     status badge (Queued or Running).
 *
 * Intentionally NOT covered (deferred):
 *   - Assert the run reaches `succeeded`. That requires an apps/server
 *     E2E_TEST_MODE short-circuit that runs runBackupBase inline against
 *     stub Airtable + real R2, plus stub endpoints for /v0/{baseId}/...
 *     records pagination. Tracked as a follow-up after this spec lands.
 *   - Assert a CSV exists in R2. Same blocker as above.
 *
 * Why a seed-endpoint shortcut instead of walking the full OAuth +
 * onboarding flow: the post-magic-link onboarding wizard plus the Airtable
 * Connect dance has ~5 UI steps, none of which are part of the
 * "click run backup now → row appears" regression this spec exists to
 * protect. The seed-endpoint surface stays tightly gated (E2E_TEST_MODE
 * Worker var + HMAC header + e2e- email prefix) so it never executes in
 * prod even if the file ships.
 *
 * Runs against the same deployed worker as `magic-link.spec.ts`. Required
 * env (set by .github/workflows/e2e-staging.yml or locally):
 *   - E2E_TARGET_URL  (e.g. https://baseout-dev.openside.workers.dev)
 *   - E2E_TEST_TOKEN
 *   - E2E_INBOX_DOMAIN  (defaults to e2e.invalid)
 */

import { createHmac } from 'node:crypto'
import { test, expect } from './fixtures'

function signEmail(secret: string, email: string): string {
  return createHmac('sha256', secret).update(email).digest('base64')
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is required for this spec`)
  return v
}

async function seedBackupHappyPath(
  baseUrl: string,
  secret: string,
  email: string,
): Promise<{ spaceId: string; organizationId: string; userId: string }> {
  const url = new URL('/api/internal/test/seed-backup-happy-path', baseUrl)
  url.searchParams.set('email', email)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-E2E-Test-Auth': signEmail(secret, email) },
  })
  if (!res.ok) {
    throw new Error(
      `seed-backup-happy-path returned ${res.status}: ${await res.text()}`,
    )
  }
  return (await res.json()) as {
    spaceId: string
    organizationId: string
    userId: string
  }
}

/**
 * Poll `/api/internal/test/last-verification` for a magic-link token created
 * AT or AFTER `mintedSince`. Returns a navigable verify URL.
 *
 * Why not use the shared `inbox.getMagicLink` fixture: that helper anchors
 * "freshness" against the moment it's called, with a hard-coded 2s tolerance.
 * In a longer spec like this one, the verification can be minted well before
 * the helper is called (seed → /login navigate → form fill → submit happens
 * before we get to the polling loop), and the 2s window rejects the row as
 * stale. Letting the test pass an explicit threshold makes the staleness gate
 * line up with the actual mint event.
 */
async function pollMagicLink(
  baseUrl: string,
  secret: string,
  email: string,
  mintedSince: number,
  timeoutMs = 60_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  const fetchUrl = new URL('/api/internal/test/last-verification', baseUrl)
  fetchUrl.searchParams.set('email', email)
  const headers = { 'X-E2E-Test-Auth': signEmail(secret, email) }
  while (true) {
    const res = await fetch(fetchUrl, { headers })
    if (res.ok) {
      const row = (await res.json()) as { token: string; createdAt: string }
      if (new Date(row.createdAt).getTime() >= mintedSince - 2_000) {
        const verify = new URL('/api/auth/magic-link/verify', baseUrl)
        verify.searchParams.set('token', row.token)
        verify.searchParams.set('callbackURL', '/')
        return verify.toString()
      }
    } else if (res.status !== 404) {
      throw new Error(
        `last-verification returned ${res.status}: ${await res.text()}`,
      )
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `pollMagicLink: no fresh token for ${email} within ${timeoutMs}ms`,
      )
    }
    await new Promise((r) => setTimeout(r, 1_000))
  }
}

test('seeded user clicks Run backup now and sees a fresh run row in the history widget', async ({
  page,
}) => {
  // The fixture polls for up to 60s; bump the test budget so the whole chain
  // (seed + login + inbox wait + navigation + click + widget settle) doesn't
  // get capped at the shared 60s default in playwright.config.
  test.setTimeout(180_000)
  const inboxDomain = process.env.E2E_INBOX_DOMAIN ?? 'e2e.invalid'
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const email = `e2e-backup-${suffix}@${inboxDomain}`

  const targetUrl = requireEnv('E2E_TARGET_URL')
  const testToken = requireEnv('E2E_TEST_TOKEN')

  // 1. Seed the chain: user + org + space + active Airtable connection +
  //    one at_base + backup_configuration with that base included.
  const seeded = await seedBackupHappyPath(targetUrl, testToken, email)
  expect(seeded.spaceId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  )

  // 2. Sign in via the existing magic-link flow. /login mints a magic-link
  //    verification right when the form is submitted; we capture that exact
  //    moment so pollMagicLink's staleness gate lines up with the mint event.
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  const mintedSince = Date.now()
  await page.getByRole('button', { name: /sign[ -]?in|magic link|continue/i }).click()
  await expect(
    page.getByRole('heading', { name: /check your email|magic link|sent/i }),
  ).toBeVisible({ timeout: 15_000 })

  const magicLinkUrl = await pollMagicLink(targetUrl, testToken, email, mintedSince)
  await page.goto(magicLinkUrl)

  // 3. Onboarding is already complete in the seed, so the user lands at "/"
  //    (or "/integrations" depending on the post-verify redirect). Navigate
  //    explicitly to keep the test independent of redirect-target tweaks.
  await page.goto('/integrations')

  // 4. The "Run backup now" button is rendered by RunBackupButton.astro under
  //    the Airtable card once a base is included (seed has one). Wait for it
  //    rather than assuming first-paint order.
  const runBtn = page.getByRole('button', { name: /run backup now/i })
  await expect(runBtn).toBeVisible({ timeout: 20_000 })
  await runBtn.click()

  // 5. RunBackupButton dispatches a success message + a backup-run-started
  //    CustomEvent the widget listens for. Assert the success copy first,
  //    then the row.
  await expect(
    page.getByText(/backup started/i),
  ).toBeVisible({ timeout: 10_000 })

  // 6. The history widget renders below the platform-cards grid (added in
  //    commit a83b24d). Wait for at least one row with a non-terminal badge
  //    to appear — the widget hydrates from SSR with no rows, then either
  //    the page reloads to pick up the new one, or the 2s poll picks it up,
  //    or the backup-run-started event triggers an immediate refresh.
  const widget = page.locator('[data-backup-history]')
  await expect(widget).toBeVisible({ timeout: 10_000 })

  const freshRow = widget.locator('li').filter({
    hasText: /running|queued/i,
  })
  await expect(freshRow.first()).toBeVisible({ timeout: 30_000 })
})
