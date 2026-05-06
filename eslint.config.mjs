// Monorepo-root ESLint flat config. Inherited by every workspace that
// does not ship its own eslint.config.* (ESLint searches upward from cwd).
// apps/web has its own config because it adds the Astro parser/plugin;
// scaffold workspaces use this one until they grow a local config.
//
// Sole purpose: enforce CLAUDE.md §5 (no stray console.* / debugger).
// Annotated calls with `// eslint-disable-next-line no-console` and a
// short justification remain allowed.
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/vendor/**',
      '**/node_modules/**',
      '**/.astro/**',
      '**/.wrangler/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/worker-configuration.d.ts',
      '**/scripts/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'no-console': 'error',
      'no-debugger': 'error',
    },
  },
]
