// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Cloudflare adapter in dev AND deploy (survey-resume change): the app needs the
// SURVEY_DB D1 binding everywhere. The v14 adapter runs `astro dev` inside
// workerd (@cloudflare/vite-plugin), so bindings in wrangler.jsonc — including
// a local miniflare D1 — work in dev with zero external setup. Run migrations
// once before first dev: pnpm --filter @baseout/survey db:migrate
export default defineConfig({
  site: 'https://survey.ui.baseout.dev',
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
});
