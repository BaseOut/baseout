# Theme

Three-tier styling priority. Don't mix approaches within a single component.

The order is fixed: `@opensided/theme` first, daisyUI second, custom CSS only as a last resort. Reuse from `src/components/ui/` before creating a new component.

## Priority

The order is fixed and applies to every component.

| Priority | Choice | When to use |
|---|---|---|
| Primary | `@opensided/theme` | First choice for all styling |
| Secondary | daisyUI | Components not covered by `@opensided/theme` |
| Fallback | Custom CSS | Only when neither covers the requirement |

If you find yourself reaching for custom CSS, double-check the theme tokens — odds are there's already a token for the spacing, colour, or component pattern you need.

## Component Discipline

Reuse beats reinvention. Keep components small and use design tokens, not hardcoded values.

- Keep components single-responsibility (DRY).
- Reuse existing UI components from `src/components/ui/` before creating new ones.
- Use design tokens from `@opensided/theme` instead of hardcoded colours, spacing, typography.
- Astro components separate markup, styles, and scripts — follow Astro best practices.
- Cross-check UI work against [shared/Baseout_PRD.md §6](../../../shared/Baseout_PRD.md) (UX direction) and [root domain-model](../../../lat.md/domain-model.md) (naming).

## Mobile-First

Design and build for mobile devices first. Test at three breakpoints in this order:

- < 375 px (small phones)
- < 768 px (large phones / small tablets)
- < 1024 px (tablets / small laptops)

Then desktop. Touch targets minimum **44 × 44 px** per WCAG. Use `astro:media` for responsive image optimisation.

## Accessibility

Semantic HTML first — `<button>`, `<nav>`, `<section>`, `<header>`, `<main>`, `<footer>` before generic `<div>` soup.

Alt text on every image. WCAG AA contrast minimum **4.5:1**. Keyboard navigation tested for all interactive components. ARIA labels only when semantic HTML is insufficient.

## Astro Specifics

Astro best practices that interact with the theme — keep markup, styles, and scripts separate per component.

- SSR by default; minimise client JS.
- Use `client:idle` or `client:visible` only when an island actually needs hydration.
- Astro's built-in CSS scoping; avoid global CSS unless necessary (global CSS lives in [src/styles/global.css](../src/styles/global.css) — keep that file small).
- Import images through `import` statements for Astro's optimisation.

## Where to Look

Pointers to theme docs and per-app rules.

- Per-app rules: [.claude/CLAUDE.md](../.claude/CLAUDE.md) §1 + §3 (UI/UX standards)
- Global styles: [src/styles/global.css](../src/styles/global.css)
- Style theming notes: [src/styles/THEMING.md](../src/styles/THEMING.md)
- UI primitives: [src/components/ui/](../src/components/ui/)
- Layouts: [src/layouts/](../src/layouts/)
