import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  // React islands are used ONLY for the Schema Docs rich-text editor (Plate)
  // and mini-diagram canvas (React Flow) — surfaces daisyUI can't provide.
  // Hydrated client:visible; see src/components/islands/README.md (governance
  // carve-out, shared-schema-docs §5).
  integrations: [react()],
  server: { port: 4331 },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  // Disabled because `wrangler dev --remote` dispatches requests through CF's
  // edge, so the worker sees a host that doesn't match the browser's Origin
  // header — Astro's check then 403s every form POST. The OAuth flow has its
  // own CSRF mitigation (PKCE + state + sealed handoff cookie) and better-auth
  // handles CSRF for auth routes, so this is acceptable defense-in-depth loss.
  // TODO: revisit alongside the HTTPS / mkcert setup; either flip back on once
  // wrangler dev runs locally (no --remote) or replace form POSTs with JSON
  // fetches that bypass the form-content-type CSRF check by design.
  security: {
    checkOrigin: false,
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
