// Minimal ESLint flat config. Sole purpose: enforce CLAUDE.md §5
// (no stray console.* / debugger). Annotated calls with
// `// eslint-disable-next-line no-console` and a short justification
// remain allowed. Other style/quality rules are intentionally left
// off — broaden in a separate pass once that scope is agreed.
import tseslint from 'typescript-eslint'
import astro from 'eslint-plugin-astro'

export default [
  {
    ignores: [
      'dist/**',
      'vendor/**',
      'node_modules/**',
      '.astro/**',
      'playwright-report/**',
      'test-results/**',
      'worker-configuration.d.ts',
      'scripts/**',
    ],
  },
  // TS parser for .ts files; Astro plugin handles its own .astro parsing.
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  ...astro.configs.recommended,
  {
    linterOptions: {
      // Avoid noise from existing `// eslint-disable-next-line` comments
      // that were anticipating rules we haven't enabled.
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'no-console': 'error',
      'no-debugger': 'error',
    },
  },
]
