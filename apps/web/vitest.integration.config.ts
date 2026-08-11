import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// postgres-js's CF polyfill races WS teardown after each isolate closes,
// surfacing as `Error: Stream was cancelled` unhandled rejections. The
// assertions still ran; this is teardown-only noise from outside our code.
// Filter narrowly here so any *other* unhandled rejection still fails the
// suite. Reconsider if/when postgres-js or wrangler ship a fix.
const POLYFILL_TEARDOWN_NOISE = /Stream was cancelled/

export default defineConfig({
  plugins: [
    // The lockfile carries two vite majors (astro's 7, vitest's 8), so the
    // plugin's Plugin<any> type resolves against a different vite copy than
    // defineConfig expects under `astro check`. Runtime is unaffected — the
    // integration suite loads this config fine. Bridge the phantom mismatch.
    cloudflareTest({
      wrangler: { configPath: './wrangler.test.jsonc' },
    }) as never,
  ],
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['./tests/integration/setup/globalSetup.ts'],
    onUnhandledError(error) {
      const message = error instanceof Error ? error.message : String(error)
      if (POLYFILL_TEARDOWN_NOISE.test(message)) return false
    },
  },
})
