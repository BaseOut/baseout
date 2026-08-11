import { defineConfig } from "vitest/config";

// Plain Vitest + Node environment. The schema package has no runtime; tests
// introspect the Drizzle table definitions (e.g. cross-dialect parity).

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
