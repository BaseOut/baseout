/**
 * Tracer for PRD §14.5 critical-flow #1:
 *   "Full signup → magic link → onboarding wizard → first backup run"
 *
 * Scope of THIS spec: signup → magic link → onboarding landing.
 * The "first backup run" portion is intentionally not yet covered —
 * the backup engine isn't built yet. Extend this spec or split a new
 * one when it is.
 *
 * Runs against staging only (see playwright.config.ts).
 */

import { test, expect } from './fixtures'

test('signup → magic link → /welcome onboarding lands', async ({ page, inbox }) => {
  // Emails MUST match /^e2e-[a-z0-9-]+@[a-z0-9.-]+$/ — the input gate on
  // /api/internal/test/last-verification refuses anything else, defending
  // the endpoint from leaking real-user tokens if the build/HMAC gates fail.
  const inboxDomain = process.env.E2E_INBOX_DOMAIN ?? 'e2e.invalid'
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const email = `e2e-${suffix}@${inboxDomain}`

  await page.goto('/register')
  await page.getByLabel(/email/i).fill(email)
  await page.getByRole('button', { name: /sign up|continue|magic link|sign[ -]?in/i }).click()

  // Confirmation copy on the post-submit screen. Target the heading so the
  // selector stays unambiguous as supporting copy evolves.
  await expect(
    page.getByRole('heading', { name: /check your email|magic link|sent/i }),
  ).toBeVisible({ timeout: 15_000 })

  const magicLinkUrl = await inbox.getMagicLink(email, { timeoutMs: 60_000 })
  expect(magicLinkUrl).toMatch(/^https?:\/\//)

  await page.goto(magicLinkUrl)

  await expect(page).toHaveURL(/\/welcome/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
})
