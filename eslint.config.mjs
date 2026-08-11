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
  {
    // Decrypt-site guard (shared-oauth-refresh-keepalive Phase 2): a stored
    // Airtable/OAuth access token must be obtained through the ConnectionDO
    // /token gate (resolveAirtableToken / the DO), never by decrypting the
    // *_enc column directly — so an idle/expired token is refreshed first under
    // the keep-alive model. New direct callers of decryptToken in apps/server
    // are a regression; route through the gate instead.
    files: ['apps/server/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportSpecifier[imported.name='decryptToken']",
          message:
            'Do not import decryptToken here — obtain access tokens via the ConnectionDO /token gate (resolveAirtableToken / the DO). Only the gate, crypto, and the BYOS storage-destination route may decrypt directly.',
        },
      ],
    },
  },
  {
    // Allowlist: the sanctioned decrypt owners.
    files: [
      'apps/server/src/lib/crypto.ts', // defines decryptToken
      'apps/server/src/durable-objects/ConnectionDO.ts', // the /token gate
      'apps/server/src/pages/api/internal/spaces/storage-destination.ts', // BYOS provider tokens
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
]
