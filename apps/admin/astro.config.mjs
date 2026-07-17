import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// apps/admin — internal staff console (tracer slice; see
// openspec/changes/admin-foundation). SSR on the Cloudflare adapter, mirroring
// apps/web. Dev runs via `astro dev` (platformProxy) on baseout.local:4332 so
// the non-Secure, host-only better-auth session cookie set by apps/web on
// baseout.local is shared with admin (the staff gate reuses that session).

// `@web/*` resolves to apps/web/src so admin consumes the shared design system
// (theme + ui/patterns primitives) with zero duplication — the same reuse
// pattern apps/design uses. NOTE: unlike apps/design (Node adapter), admin runs
// on workerd where `cloudflare:workers` is a real module, so we do NOT alias it
// to a stub here.
const webSrc = fileURLToPath(new URL('../web/src', import.meta.url));

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  server: { host: 'baseout.local', port: 4332 },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: [{ find: /^@web\/(.*)$/, replacement: `${webSrc}/$1` }],
    },
  },
});
