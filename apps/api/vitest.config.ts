import { defineConfig } from "vitest/config";

// Plain Vitest (node) over the pure modules — auth decisions, pagination, the
// registry router, OpenAPI generation. DB/handler behavior is exercised by the
// deployed smoke (openspec/changes/api-rest-read/smoke.mjs), matching the
// apps/server pure-test + smoke split.

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
