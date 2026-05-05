# Theming

Baseout uses two locked DaisyUI themes and a brand font.

## Themes

- `baseout-light` — default (light)
- `baseout` — dark

Full theme definitions (base/status/accent/radius tokens) live in
[themes/baseout.css](themes/baseout.css). The `@opensided/theme` package ships
only partial `[data-theme="baseout-*"]` overrides (primary/secondary/root-bg/
layout-\* + chart vars) at `node_modules/@opensided/theme/src/styles/daisyui.css`
lines 453+, which layer on top via the import order in
[global.css](global.css).

Do **not** set `data-theme` to `snow`, `midnight`, or any other built-in
DaisyUI theme — those aren't the Baseout brand.

## Font

Brand font is **Geist**, activated via `data-font-family="geist"` on `<html>`.
The selector that maps the attribute to `--font-sans` is registered in
[typography.css](../../node_modules/@opensided/theme/src/styles/typography.css)
(line 52), and the Google Fonts `@import` at the top of that file loads the
family.

Do **not** override `--color-primary` or `--font-sans` in project CSS —
change attributes on `<html>` instead.

## Toggle

Light/dark switching lives in the inline script in
[Layout.astro](../layouts/Layout.astro). `localStorage.theme` stores
`'light' | 'dark'`; the script maps `'dark' → baseout`, otherwise
`baseout-light`. The same handler runs on `astro:after-swap` so theme
state survives Astro view transitions.
