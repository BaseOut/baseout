import { defineConfig } from "vitest/config";

// Plain Vitest (node) over the pure receiver handler — deps injected, MAC
// verification uses the REAL @baseout/shared crypto (no mocked verify).
// End-to-end wire behavior is covered by the wrangler-dev curl smoke
// (openspec/changes/hooks smoke instructions).

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
