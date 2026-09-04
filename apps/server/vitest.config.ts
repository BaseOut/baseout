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
  SERVER_INTERNAL_TOKEN: "test-only-internal-token-min-32-chars-aaaa",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@127.0.0.1:5432/baseout_test_unused",
  // 32 zero bytes, base64 — tests inject their own keys via deps; this just
  // satisfies the typed Env shape so the worker entry boots.
  BASEOUT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  TRIGGER_SECRET_KEY: "tr_dev_test_unused",
  TRIGGER_PROJECT_REF: "proj_test_unused",
  AIRTABLE_OAUTH_CLIENT_ID: "test-airtable-client-id",
  AIRTABLE_OAUTH_CLIENT_SECRET: "test-airtable-client-secret",
  AIRTABLE_ON_DEMAND_REFRESH_ENABLED: "0",
};

// Real-PG I/O suites (automations-interfaces-io) need Node — workerd does not
// forward RUN_DB_TESTS/DATABASE_URL into the isolate, and postgres-js sockets
// are unreliable under the workers pool. Everything else stays on workerd.
const NODE_PG_TESTS = ["tests/integration/per-space/automations-interfaces-io.test.ts"];

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.test.jsonc" },
            miniflare: { bindings: TEST_BINDINGS },
          }),
        ],
        test: {
          name: "workers",
          include: ["tests/integration/**/*.test.ts"],
          exclude: NODE_PG_TESTS,
          onUnhandledError(error) {
            const message = error instanceof Error ? error.message : String(error);
            if (HANDLED_NOISE.test(message)) return false;
          },
        },
      },
      {
        test: {
          name: "node-pg",
          environment: "node",
          include: NODE_PG_TESTS,
          env: {
            RUN_DB_TESTS: process.env.RUN_DB_TESTS ?? "",
            DATABASE_URL: process.env.DATABASE_URL ?? "",
          },
        },
      },
    ],
  },
});
