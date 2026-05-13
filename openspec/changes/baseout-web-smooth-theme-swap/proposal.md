## Why

Toggling between light and dark theme in `apps/web` produces a visible "trickle" — different parts of the UI cross-fade out of sync rather than swapping as a single, unified paint. Diagnosed on 2026-05-12 from [apps/web/src/layouts/Layout.astro](../../../apps/web/src/layouts/Layout.astro) and [apps/web/src/components/layout/Sidebar.astro](../../../apps/web/src/components/layout/Sidebar.astro):

1. **`<body class="... transition-colors duration-300">`** ([Layout.astro:47](../../../apps/web/src/layouts/Layout.astro)). When `[data-theme]` flips, daisyUI's CSS-variable values (`--color-base-100`, `--color-base-content`, etc.) change instantly. Elements that inherit `transition-colors` from `<body>` cross-fade over 300 ms; elements that set their own `background-color` / `border-color` / `fill` with no per-element transition snap instantly. The mixed timing is the trickle.
2. **Two competing toggle mechanisms** ([Sidebar.astro:422, 489, 655–665](../../../apps/web/src/components/layout/Sidebar.astro)). Both checkbox inputs carry daisyUI's `class="theme-controller"` (which applies `[data-theme]=<input.value>` on *check*) **and** a manual `change` listener that does the full toggle including the *uncheck* → light path. Two systems mutating the same attribute = redundant work and possible double-paint on toggle-on.
3. **No View Transitions API on the swap**, even though `<ClientRouter />` is already wired ([Layout.astro:37](../../../apps/web/src/layouts/Layout.astro)), so the platform's `document.startViewTransition` path is already available.
4. **No `prefers-color-scheme` signal.** First-visit users always land in light regardless of OS preference (FOUC script: `localStorage.getItem('theme') || 'light'`).

## What Changes

- **Wrap the `[data-theme]` mutation in `document.startViewTransition()`** (feature-detected). On Chromium/Safari this produces a single, unified, GPU-accelerated cross-fade. On Firefox the swap is instant — still flicker-free, just unanimated.
- **Drop `transition-colors duration-300` from `<body>`** so individual elements stop racing the view transition.
- **Set `style="color-scheme: light dark"` on `<html>`** so native widgets (form controls, scrollbars, `input[type="date"]`) follow the theme without per-element overrides.
- **Read OS preference in the FOUC script** when no `localStorage.theme` exists: `window.matchMedia('(prefers-color-scheme: dark)').matches`. Persisted user choice still wins.
- **Consolidate the toggle logic into a new [apps/web/src/lib/theme.ts](../../../apps/web/src/lib/theme.ts)** with `getInitialTheme`, `applyTheme`, and `wireThemeToggle`. Both sidebar toggle inputs wire to it; a `CustomEvent('baseout:theme-change')` keeps the two checkboxes in sync without each re-reading localStorage.
- **Remove the redundant `class="theme-controller"` and `value="baseout"` from both toggle inputs** in [Sidebar.astro](../../../apps/web/src/components/layout/Sidebar.astro). The manual handler (via the new module) is the single source of truth.
- **Append a `::view-transition-old(root)` / `::view-transition-new(root)` rule to [global.css](../../../apps/web/src/styles/global.css)** to tune duration to ~220 ms and respect `prefers-reduced-motion`.

## Out of Scope

- **Tri-state toggle (System / Light / Dark).** Keep the existing binary switch UI. OS preference is only consulted on first visit (when no user choice is stored).
- **Per-page / per-component theme overrides.** Single global theme.
- **Custom themes beyond `baseout` / `baseout-light`.** The daisyUI theme definitions in [apps/web/src/styles/themes/baseout.css](../../../apps/web/src/styles/themes/baseout.css) are unchanged.
- **`@opensided/theme`'s React `ThemeToggle.tsx`.** Not used by the current Astro Sidebar implementation; not introduced by this change.
- **Renaming the localStorage key.** Stays `'theme'` with values `'dark' | 'light'` so existing users' saved preferences continue to work.
- **System-preference live updates** (reacting to OS theme changes mid-session via `matchMedia(...).addEventListener('change', ...)`). The OS read is one-shot at FOUC time when no stored preference exists. Mid-session OS toggles take effect on the next reload. Adding live tracking is a future change.

## Capabilities

This is a UX / front-end polish change. No new product capability is introduced. No existing spec under [openspec/changes/baseout-web/specs/](../baseout-web/specs/) describes the theme toggle today; no spec delta is added by this change. If review later determines theme behavior should be documented as a first-class capability, it can be added under `baseout-web/specs/dashboard/` in a follow-up.

## Impact

- **Behavior:** First-visit users land in their OS-preferred theme. Returning users still land in their persisted choice. Toggling cross-fades smoothly on Chromium/Safari, snaps cleanly on Firefox. Native form widgets and scrollbars follow the active theme.
- **Bundle:** Adds one small TS module (`src/lib/theme.ts`, ~60 LOC). Removes inline theme JS from Sidebar.astro. Net ≈ neutral.
- **Markup:** `<html>` gains `style="color-scheme: light dark"`. `<body>` loses two utility classes. Toggle inputs lose one class + one attribute each.
- **Soft-nav:** Unchanged. The FOUC script still re-applies theme on `astro:after-swap`. Sidebar's `init()` still rebinds toggles on `astro:after-swap`.
- **Tests:** None added in this change. The new module is small, deterministic, and exercised by the existing UI; smoke verification is manual per the Verification section of the plan.
- **Security:** Zero new surface. No new secrets, no new auth path, no new API. The `prefers-color-scheme` read and View Transitions API are platform-built-ins.
- **A11y:** Honors `prefers-reduced-motion` via the new CSS rule. Toggle inputs keep their existing `aria-label="Toggle theme"`.

## Reversibility

Mechanical. Revert the diff to:

- [apps/web/src/layouts/Layout.astro](../../../apps/web/src/layouts/Layout.astro) (restore body `transition-colors duration-300`, remove `style="color-scheme"`, restore the simpler FOUC script).
- [apps/web/src/components/layout/Sidebar.astro](../../../apps/web/src/components/layout/Sidebar.astro) (restore `theme-controller` class, `value="baseout"`, and the inline toggle handler block).
- [apps/web/src/styles/global.css](../../../apps/web/src/styles/global.css) (remove the `::view-transition-*` rule).
- Delete [apps/web/src/lib/theme.ts](../../../apps/web/src/lib/theme.ts).

No data migration. No env-var change. No deploy ordering. Local-only revert.
