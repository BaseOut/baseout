import { defineConfig } from 'vitest/config'

// Pure unit tests (gate policy, tracker grouping) — node env, no Astro/DB.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
