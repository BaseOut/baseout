import { defineConfig, devices } from '@playwright/test'

// Per PRD §14, Playwright runs against a live deployed worker (the dev
// environment for the tracer; staging/prod when those exist). E2E_TARGET_URL
// is required — fail loud rather than silently default to localhost (which
// would not exercise the real worker stack).
const E2E_TARGET_URL = process.env.E2E_TARGET_URL
if (!E2E_TARGET_URL) {
  throw new Error(
    'E2E_TARGET_URL is required for Playwright. Per PRD §14, e2e runs against ' +
      'a deployed worker. CI sets it from the workflow env; for local runs, ' +
      'export E2E_TARGET_URL=https://baseout-dev.openside.workers.dev',
  )
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Single tracer for now — preserve clean inbox + DB state between specs.
  fullyParallel: false,
  workers: 1,
  // Always 0 — a passing-on-retry test is exactly how race conditions hide.
  // If a real flake surfaces, fix the root cause; document any temporary
  // exception inline next to the test that needs it.
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: E2E_TARGET_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
