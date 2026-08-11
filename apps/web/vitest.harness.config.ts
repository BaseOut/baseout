// Vitest config for createTestHarness()-based cross-Worker tests
// (openspec/changes/system-test-harness-spike). Plain Node environment —
// the harness boots real workerd processes; the test itself runs in Node
// so MSW (msw/node) can intercept the Workers' outbound fetch, which the
// harness proxies through this process's undici dispatcher.
//
// globalSetup wraps the integration one (wait for Postgres + drizzle
// migrations) and boots a disposable embedded PostgreSQL 16 first when no
// Docker test DB is listening on 5432.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/harness/**/*.test.ts'],
    globalSetup: ['./tests/harness/setup/globalSetup.ts'],
    // Booting two workerd Workers (with TS bundling) is slow on first run.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
})
