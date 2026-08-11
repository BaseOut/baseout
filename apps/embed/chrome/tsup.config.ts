import { defineConfig } from 'tsup'

// EMBED_APP_ORIGIN is baked at build time (embed change, design Decision 6) —
// a wrapper that can be pointed at an arbitrary origin at runtime is a
// phishing primitive. Dev default is the local web app.
export default defineConfig({
  entry: { background: 'src/background.ts', sidepanel: 'src/sidepanel.ts' },
  format: 'esm',
  outDir: 'dist',
  clean: true,
  // Extensions have no node_modules at runtime — inline the workspace deps
  // (tsup externalizes package.json dependencies by default).
  noExternal: ['@baseout/embed-core', '@baseout/embed-protocol'],
  env: {
    EMBED_APP_ORIGIN: process.env.EMBED_APP_ORIGIN ?? 'https://baseout.local:4331',
  },
})
