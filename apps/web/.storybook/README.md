# Storybook — `apps/web` component catalog

The **component-level** catalog for the Baseout web UI. Each `src/components/ui/*.astro`
primitive is rendered in isolation across its prop/variant matrix, in the real
daisyUI + `@opensided/theme` styling.

```bash
pnpm --filter @baseout/web storybook        # dev server → http://localhost:6006
pnpm --filter @baseout/web build-storybook   # static build → dist/storybook (CI runs this)
```

## How it works (Astro has no Storybook renderer)

Our components are pure `.astro` (no React/Vue island), and Storybook has no Astro
renderer. So we use the **`@storybook/html-vite`** renderer and render each component
to an HTML string via **Astro's Container API**:

- `.storybook/render-astro.ts` — `renderAstro(Component, { props, slots })` wraps
  `experimental_AstroContainer`. `slots` is a default-slot HTML string or a
  `{ name: html }` map.
- `.storybook/main.ts` — `viteFinal` injects Astro's compiler plugins via
  `getViteConfig({}, { configFile: false })` (the `configFile: false` is load-bearing:
  it skips `astro.config.mjs` so the Cloudflare adapter — and its wrangler-remote
  Vite plugin — never loads), plus `@tailwindcss/vite` so daisyUI/`global.css` compile.
- `.storybook/preview.ts` — imports `global.css` + FontAwesome, and adds the
  light/dark (`data-theme`) + brand-font (`data-font-family`) toolbars, matching production.

### Story shape

Container rendering is async, so render via a **loader**, not an async `render`:

```ts
import type { Meta, StoryObj } from '@storybook/html-vite';
import Button from './Button.astro';
import { renderAstro } from '../../../.storybook/render-astro';

const meta: Meta<{ variant: string; label: string }> = {
  title: 'UI/Button',
  loaders: [async ({ args: { label, ...props } }) => ({ html: await renderAstro(Button, { props, slots: label }) })],
  render: (_args, { loaded }) => loaded.html,
  argTypes: { variant: { control: 'select', options: ['primary', 'secondary'] } },
};
export default meta;
export const Primary: StoryObj = {};
```

## Important: structure + styling, NOT behavior

The Container API renders a component's **static HTML + scoped styles only**. It does
**not** execute `.astro` client `<script>` blocks. So:

- `Modal` (and `CreateSpaceModal`) won't auto-open — their stories use a Storybook
  `play` function calling `dialog.showModal()`. Use that pattern for any
  script-bearing component.
- For real interaction/behavior, use **`apps/design`** (a live Astro server), not Storybook.

Don't file "behavior X doesn't work in Storybook" — it's by design.

## Storybook vs. `apps/design` /styleguide

| | Storybook (here) | `apps/design` `/styleguide` |
|---|---|---|
| Altitude | one **component**, every prop/variant | **design system** (tokens) + **pages** |
| Source | the real `ui/*.astro` via Container API | the designer's catalog (`storybook.ts`) |
| Use for | "is this component right across its matrix?" | "when to use which; tokens; full-page look" |

Both pull `global.css` / `@opensided/theme` from `apps/web`, so a token change shows
in both. **Governance + the rules** (every component needs a story; daisyUI-first;
the coverage test) live in `apps/web/.claude/CLAUDE.md` §2.5.
