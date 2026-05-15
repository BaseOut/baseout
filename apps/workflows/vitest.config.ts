import { defineConfig } from "vitest/config";

// Plain Vitest + Node environment. Trigger.dev tasks run on the Trigger.dev
// runner (Node), NOT inside workerd, so tests do not need
// @cloudflare/vitest-pool-workers. Use vi.fn() for HTTP, fs mocks etc.

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
