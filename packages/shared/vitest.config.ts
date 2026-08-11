import { defineConfig } from "vitest/config";

// Plain Vitest + Node environment, matching packages/db-schema. Tests import
// from ../src directly, so no build step is required to run them.

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
