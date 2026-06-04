import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

const webSrc = fileURLToPath(new URL('../web/src', import.meta.url));

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  publicDir: fileURLToPath(new URL('../web/public', import.meta.url)),
  server: { port: 4332, host: true },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  security: {
    checkOrigin: false,
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: [
        { find: /^@web\/(.*)$/, replacement: `${webSrc}/$1` },
        {
          find: 'cloudflare:workers',
          replacement: fileURLToPath(new URL('./src/lib/cloudflare-workers-stub.ts', import.meta.url)),
        },
      ],
    },
  },
});
