import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// onUnhandledError filter — apps/web's pattern for postgres-js teardown noise.
// Apps/server doesn't hit postgres-js yet, but the filter is in place for PR2.
// NOTE: this DOES NOT filter the `exception = workerd/api/web-socket.c++:821:
// disconnected: WebSocket peer disconnected` lines; those are workerd-internal
// stderr emitted during test-isolate teardown, not JS-level unhandled errors,
// and they're unfilterable from here. They don't fail the suite. Known
// upstream issue in @cloudflare/vitest-pool-workers.
const HANDLED_NOISE = /Stream was cancelled/;

// Test-only binding values. Passed via miniflare.bindings so they override
// any .dev.vars present locally — without this, miniflare's .dev.vars loader
// would shadow wrangler.test.jsonc `vars` with the developer's real local
// secrets. PR2 (real Postgres) will swap DATABASE_URL for a Docker test DB.
const TEST_BINDINGS = {
  INTERNAL_TOKEN: "test-only-internal-token-min-32-chars-aaaa",
  DATABASE_URL:
    "postgres://postgres:postgres@127.0.0.1:5432/baseout_test_unused",
  TRIGGER_SECRET_KEY: "tr_dev_test_unused",
  TRIGGER_PROJECT_REF: "proj_test_unused",
};

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.test.jsonc" },
      miniflare: { bindings: TEST_BINDINGS },
    }),
  ],
  test: {
    include: ["tests/integration/**/*.test.ts"],
    onUnhandledError(error) {
      const message = error instanceof Error ? error.message : String(error);
      if (HANDLED_NOISE.test(message)) return false;
    },
  },
});
