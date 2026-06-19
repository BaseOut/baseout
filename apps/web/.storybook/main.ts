import type { StorybookConfig } from '@storybook/html-vite';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

/**
 * Storybook for the apps/web component catalog. The component-level companion to
 * the designer's page-level harness at apps/design /styleguide (see .storybook/README).
 *
 * Renderer: @storybook/html-vite. Our components are pure .astro (no framework
 * island), so each story renders the component to an HTML string via Astro's
 * Container API (see render-astro.ts) and the HTML renderer injects it.
 */
const config: StorybookConfig = {
  framework: '@storybook/html-vite',
  stories: ['../src/components/**/*.stories.@(ts|mdx)'],
  addons: ['@storybook/addon-themes'],
  core: { disableTelemetry: true },
  async viteFinal(cfg, { configType }) {
    const { mergeConfig } = await import('vite');
    // Storybook's Vite has no Astro compiler, so `.astro` imports won't transform.
    // Pull Astro's compiler plugins via getViteConfig with `configFile: false` —
    // that SKIPS apps/web's astro.config.mjs (and its Cloudflare adapter + the
    // @cloudflare/vite-plugin that needs a wrangler remote login), giving just the
    // plugins that compile .astro for the Container API.
    const { getViteConfig } = await import('astro/config');
    const isBuild = configType === 'PRODUCTION';
    const astroCfgFn = getViteConfig({}, { configFile: false });
    const astroCfg = await astroCfgFn({
      command: isBuild ? 'build' : 'serve',
      mode: isBuild ? 'production' : 'development',
    });

    return mergeConfig(cfg, {
      plugins: [
        // Astro compiler (.astro → JS) — first so the others see transformed output.
        astroCfg.plugins,
        // Reuse the exact Tailwind v4 + daisyUI engine apps/web uses. WITHOUT this,
        // global.css compiles no utilities and every story renders unstyled.
        tailwindcss(),
      ],
      resolve: {
        alias: [
          // Defensive: ui/ stories don't reach `cloudflare:workers`, but future
          // higher-level-view stories would. Stub it (mirrors apps/design).
          {
            find: 'cloudflare:workers',
            replacement: fileURLToPath(
              new URL('../src/lib/cloudflare-workers-stub.storybook.ts', import.meta.url),
            ),
          },
        ],
      },
    });
  },
};

export default config;
