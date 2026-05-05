import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  server: { port: 4331 },
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
