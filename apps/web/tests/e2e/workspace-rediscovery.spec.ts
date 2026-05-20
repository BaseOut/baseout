/**
 * Playwright coverage for the manual workspace-rediscovery UI flow.
 *
 * Replaces the 2 unchecked manual smoke tasks in
 * openspec/changes/web-workspace-rediscovery/tasks.md (rescan happy-path
 * + tier-cap edge case) with deterministic e2e tests.
 *
 * Three scenarios, one per customer-facing branch of the rescan flow:
 *   - discover_only — auto-add OFF, fresh base shows up only in the banner
 *   - auto_add      — auto-add ON, fresh base lands in the included list
 *   - tier_cap      — auto-add ON but no slots left, base blocked by tier
 *
 * The engine's `listAirtableBases` is short-circuited by E2E_TEST_MODE so the
 * test reads from `baseout.e2e_pending_airtable_bases` instead of calling
 * Airtable's Meta API (see apps/server/src/lib/rediscovery/run-deps.ts).
 * `/api/internal/test/seed-workspace-rediscovery` provisions the per-scenario
 * fixture: user + org + space + active Airtable connection (stub token),
 * baseline at_bases + included rows, plus the one pending stub.
 *
 * Runs against the same deployed dev worker as the other specs. Required env:
 *   - E2E_TARGET_URL   (e.g. https://baseout-dev.openside.workers.dev)
 *   - E2E_TEST_TOKEN
 *   - E2E_INBOX_DOMAIN (defaults to e2e.invalid)
 *
 * Deployed engine MUST also have `E2E_TEST_MODE=true` set as a worker var
 * for the rescan to read the stub table — otherwise the engine will try
 * to decrypt the seed's non-real stub token and 502.
 */

import { createHmac } from 'node:crypto'
import { test, expect } from './fixtures'

type Scenario = 'discover_only' | 'auto_add' | 'tier_cap'

interface SeedResponse {
  userId: string
  organizationId: string
  spaceId: string
  configurationId: string
  pendingAtBaseIds: string[]
}

function signEmail(secret: string, email: string): string {
  return createHmac('sha256', secret).update(email).digest('base64')
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is required for this spec`)
  return v
}

async function seedWorkspaceRediscovery(
  baseUrl: string,
  secret: string,
  email: string,
  scenario: Scenario,
): Promise<SeedResponse> {
  const url = new URL(
    '/api/internal/test/seed-workspace-rediscovery',
    baseUrl,
  )
  url.searchParams.set('email', email)
  url.searchParams.set('scenario', scenario)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-E2E-Test-Auth': signEmail(secret, email) },
  })
  if (!res.ok) {
    throw new Error(
      `seed-workspace-rediscovery returned ${res.status}: ${await res.text()}`,
    )
  }
  return (await res.json()) as SeedResponse
}

/**
 * Same shape as backup-happy-path's `pollMagicLink` — anchors freshness
 * against an explicit mint timestamp so the inbox helper's 2s tolerance
 * doesn't trip after a slow seed+login chain.
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
  // eslint-disable-next-line no-constant-condition
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

async function seedAndSignIn(
  page: import('@playwright/test').Page,
  scenario: Scenario,
  emailPrefix: string,
): Promise<SeedResponse> {
  const inboxDomain = process.env.E2E_INBOX_DOMAIN ?? 'e2e.invalid'
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const email = `e2e-${emailPrefix}-${suffix}@${inboxDomain}`

  const targetUrl = requireEnv('E2E_TARGET_URL')
  const testToken = requireEnv('E2E_TEST_TOKEN')

  const seeded = await seedWorkspaceRediscovery(
    targetUrl,
    testToken,
    email,
    scenario,
  )

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  const mintedSince = Date.now()
  await page
    .getByRole('button', { name: /sign[ -]?in|magic link|continue/i })
    .click()
  await expect(
    page.getByRole('heading', { name: /check your email|magic link|sent/i }),
  ).toBeVisible({ timeout: 15_000 })

  const magicLinkUrl = await pollMagicLink(
    targetUrl,
    testToken,
    email,
    mintedSince,
  )
  await page.goto(magicLinkUrl)
  await page.goto('/integrations')

  return seeded
}

test.describe('workspace rediscovery — manual rescan UI flow', () => {
  // Each scenario does: seed → login → rescan → assert. Budget includes the
  // built-in 60s magic-link poll plus the post-rescan auto-reload (1.2s).
  test.setTimeout(180_000)

  test('discover_only — banner shows the discovery, dismiss clears it', async ({
    page,
  }) => {
    await seedAndSignIn(page, 'discover_only', 'rescan-discover')

    const rescanBtn = page.getByRole('button', { name: /rescan workspace/i })
    await expect(rescanBtn).toBeVisible({ timeout: 20_000 })
    await rescanBtn.click()

    // After 1.2s the page reloads and the SSR banner appears with the event
    // row inserted by the orchestrator. Wait for the banner.
    const banner = page.locator('[data-space-events-banner]')
    await expect(banner).toBeVisible({ timeout: 30_000 })
    await expect(
      banner.getByText(/1 new base discovered in your Airtable workspace/i),
    ).toBeVisible()
    // No auto-added / blocked-by-tier copy when toggle is off.
    await expect(banner.getByText(/auto-added/i)).toHaveCount(0)
    await expect(banner.getByText(/not included/i)).toHaveCount(0)

    // Dismiss the only event card; the banner container disappears.
    const dismissBtn = banner.getByRole('button', { name: /dismiss/i })
    await dismissBtn.click()
    await expect(banner).toBeHidden({ timeout: 10_000 })
  })

  test('auto_add — fresh base is auto-included and shows in the list', async ({
    page,
  }) => {
    await seedAndSignIn(page, 'auto_add', 'rescan-autoadd')

    const rescanBtn = page.getByRole('button', { name: /rescan workspace/i })
    await expect(rescanBtn).toBeVisible({ timeout: 20_000 })
    await rescanBtn.click()

    const banner = page.locator('[data-space-events-banner]')
    await expect(banner).toBeVisible({ timeout: 30_000 })
    await expect(banner.getByText(/1 auto-added to your backups/i)).toBeVisible()
    await expect(banner.getByText(/not included/i)).toHaveCount(0)

    // The new base is now in the "Bases to back up" form with its checkbox
    // checked. The seed labels the pending base "New Base From Workspace".
    const selectionForm = page.locator('[data-base-selection-form]')
    await expect(selectionForm).toBeVisible()
    const newBaseRow = selectionForm
      .locator('li')
      .filter({ hasText: /New Base From Workspace/i })
    await expect(newBaseRow).toBeVisible()
    await expect(newBaseRow.locator('[data-base-checkbox]')).toBeChecked()
  })

  test('tier_cap — fresh base is blocked, not in the included list', async ({
    page,
  }) => {
    await seedAndSignIn(page, 'tier_cap', 'rescan-tiercap')

    const rescanBtn = page.getByRole('button', { name: /rescan workspace/i })
    await expect(rescanBtn).toBeVisible({ timeout: 20_000 })
    await rescanBtn.click()

    const banner = page.locator('[data-space-events-banner]')
    await expect(banner).toBeVisible({ timeout: 30_000 })
    await expect(
      banner.getByText(/1 not included — you're at your tier limit/i),
    ).toBeVisible()
    await expect(banner.getByText(/auto-added/i)).toHaveCount(0)

    // The new base is now visible in the list (rediscovery upserts at_bases
    // for every listed base, including the blocked one) — but its checkbox
    // is NOT checked because the cap prevented auto-add.
    const selectionForm = page.locator('[data-base-selection-form]')
    await expect(selectionForm).toBeVisible()
    const newBaseRow = selectionForm
      .locator('li')
      .filter({ hasText: /New Base From Workspace/i })
    await expect(newBaseRow).toBeVisible()
    await expect(newBaseRow.locator('[data-base-checkbox]')).not.toBeChecked()
  })
})
