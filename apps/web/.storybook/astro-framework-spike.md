# Astro Storybook Renderer Spike

Status: decision recorded during `system-component-governance` planning.

## Current Baseline

`apps/web` currently uses `@storybook/html-vite` plus Astro's Container API through
`render-astro.ts`.

Observed verification:

- `pnpm --filter @baseout/web build-storybook` succeeds.
- Existing `ui/*.astro` stories render through async loaders.
- Tailwind v4 + daisyUI styling is applied by importing `global.css` in
  `preview.ts` and registering `@tailwindcss/vite` in `main.ts`.
- `astro.config.mjs` is intentionally skipped with `getViteConfig({}, {
  configFile: false })`, avoiding the Cloudflare adapter and wrangler remote
  coupling.

Known limitation: component `<script>` blocks are not executed by Container
rendering. Script-bearing components need a Storybook `play()` function for
structure-level demos and the live `apps/design` harness for behavior checks.

## `@storybook-astro/framework` Finding

Current public docs show that `@storybook-astro/framework` exists and also uses
Astro's Container API. It adds framework-level handling for `.astro` stories,
scoped styles, slots, and Astro/framework mixed rendering.

The framework is worth testing in isolation, but it is not a free migration:

- Existing stories are typed against `@storybook/html-vite`.
- The current setup already avoids `astro.config.mjs` because loading the full
  app config pulls in Cloudflare/wrangler behavior.
- Any migration must prove it preserves Tailwind v4, daisyUI, FontAwesome,
  `@opensided/theme`, and the `cloudflare:workers` stub behavior.

## Decision

Keep the current `@storybook/html-vite` renderer for this governance change.
Do not migrate Storybook until a dedicated spike branch proves:

1. All existing `ui/*.astro` stories build.
2. The framework does not load the Cloudflare adapter or require wrangler login.
3. Global styling matches the current Storybook and `apps/design` `/styleguide`.
4. Script-bearing components are either improved or documented with the same
   `play()` / `apps/design` behavior split.

