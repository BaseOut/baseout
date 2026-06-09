import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// apps/admin — internal staff console (tracer slice; see
// openspec/changes/admin-foundation). SSR on the Cloudflare adapter, mirroring
// apps/web. Dev runs via `astro dev` (platformProxy) on baseout.local:4332 so
// the non-Secure, host-only better-auth session cookie set by apps/web on
// baseout.local is shared with admin (the staff gate reuses that session).
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  server: { host: 'baseout.local', port: 4332 },
  vite: {
    plugins: [tailwindcss()],
  },
});
