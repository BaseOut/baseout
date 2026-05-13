## Overview

Replace the current `[data-theme]`-swap-plus-300 ms-`transition-colors` approach with a feature-detected `document.startViewTransition()` wrapper, a single-source-of-truth toggle module, and a first-visit `prefers-color-scheme` read. Net result: one unified cross-fade on browsers that support View Transitions; instant, flicker-free snap on browsers that don't; OS preference honored on first visit.

## Stack

| Concern | Choice | Note |
|---|---|---|
| Theme attribute | `[data-theme]` on `<html>` | Unchanged. daisyUI's documented swap mechanism. |
| Themes | `baseout` (dark), `baseout-light` (light) | Defined in [apps/web/src/styles/themes/baseout.css](../../../apps/web/src/styles/themes/baseout.css). Unchanged. |
| Persistence | `localStorage.setItem('theme', 'dark' \| 'light')` | Unchanged key + value shape. |
| First-visit default | `window.matchMedia('(prefers-color-scheme: dark)').matches` | New. One-shot read in the inline FOUC script. |
| Swap animation | `document.startViewTransition(fn)` with `typeof` feature detection | Single unified paint where supported; instant fallback elsewhere. |
| Native widgets | `color-scheme: light dark` on `<html>` | Lets the UA flip form controls / scrollbars without per-element overrides. |
| Toggle module | New `apps/web/src/lib/theme.ts` | Exports `getInitialTheme`, `applyTheme`, `wireThemeToggle`. Pure DOM, no nanostores. |
| Toggle sync | `CustomEvent('baseout:theme-change', { detail: { mode } })` | Dispatched from `applyTheme`; sibling toggle listens and reflects state. |
| FOUC prevention | `<script is:inline>` in `<head>` | Unchanged shape; just gains the `prefers-color-scheme` fallback. |
| Soft-nav | `astro:after-swap` re-runs FOUC script's `applyTheme` + Sidebar's `init()` | Unchanged. |

## Source Layout

```
apps/web/
├── src/
│   ├── layouts/
│   │   └── Layout.astro                  # inline FOUC script adds prefers-color-scheme fallback;
│   │                                     #   <html> gains style="color-scheme: light dark";
│   │                                     #   <body> loses transition-colors duration-300.
│   ├── lib/
│   │   └── theme.ts                      # NEW — getInitialTheme, applyTheme, wireThemeToggle
│   ├── components/layout/
│   │   └── Sidebar.astro                 # toggle inputs lose `class="theme-controller" value="baseout"`;
│   │                                     #   <script> imports wireThemeToggle and calls it inside init().
│   └── styles/
│       └── global.css                    # appends ::view-transition-old(root) / -new(root) rule
│                                         #   + prefers-reduced-motion no-op.
```

## Module API (after this change)

```ts
// apps/web/src/lib/theme.ts

export type ThemeMode = 'dark' | 'light';

/**
 * Read the initial theme to apply.
 * Order: stored localStorage value → OS prefers-color-scheme → 'light'.
 */
export function getInitialTheme(): ThemeMode;

export interface ApplyThemeOptions {
  /** Wrap the mutation in document.startViewTransition() when available. Default: true. */
  animate?: boolean;
  /** Persist to localStorage. Default: true. Set false for the first-load FOUC path. */
  persist?: boolean;
}

/**
 * Apply `mode` to <html>'s [data-theme], optionally persisting and animating.
 * Dispatches `CustomEvent('baseout:theme-change', { detail: { mode } })` on document
 * so other UI (sibling toggles) can sync.
 */
export function applyTheme(mode: ThemeMode, options?: ApplyThemeOptions): void;

/**
 * Wire a checkbox input to the theme system.
 *
 * - Reflects the current theme on the input's `.checked`.
 * - On `change`: applies the new theme (animated via View Transitions when supported).
 * - On `baseout:theme-change` from document: re-reflects state (keeps sibling toggles in sync).
 *
 * Safe to call multiple times on the same input (idempotent — listeners are attached once
 * per input via a `data-theme-wired` sentinel attribute).
 */
export function wireThemeToggle(input: HTMLInputElement): void;
```

## Inline FOUC Script (after this change)

```html
<script is:inline>
  (function () {
    var stored = localStorage.getItem('theme');
    var isDark = stored === 'dark'
      || (!stored && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', isDark ? 'baseout' : 'baseout-light');
  })();
  document.addEventListener('astro:after-swap', function () {
    var stored = localStorage.getItem('theme');
    var isDark = stored === 'dark'
      || (!stored && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', isDark ? 'baseout' : 'baseout-light');
  });
</script>
```

Notes:

- Must stay `is:inline` and live in `<head>` so it runs synchronously before stylesheets paint. Otherwise the page paints light then snaps to dark.
- Cannot import from `apps/web/src/lib/theme.ts` — Astro would emit a module script with `defer` semantics, defeating FOUC prevention. The inline script duplicates the small read logic on purpose; `theme.ts` owns the toggle path (which runs after hydration anyway).
- `matchMedia` is guarded with `window.matchMedia &&` because the inline script runs in legacy browser support range too.

## View Transitions Pattern

```ts
// inside applyTheme(mode, opts)
function swap() {
  document.documentElement.setAttribute('data-theme', mode === 'dark' ? 'baseout' : 'baseout-light');
  if (opts?.persist !== false) {
    try { localStorage.setItem('theme', mode); } catch { /* private mode, etc. */ }
  }
  document.dispatchEvent(new CustomEvent('baseout:theme-change', { detail: { mode } }));
}

if (opts?.animate !== false && typeof document.startViewTransition === 'function') {
  document.startViewTransition(swap);
} else {
  swap();
}
```

- Feature-detected via `typeof document.startViewTransition === 'function'`. Don't rely on a TS lib check — the API is a recent TS dom lib addition and some toolchains don't include it.
- `startViewTransition` takes a callback that mutates the DOM synchronously; the UA snapshots before and after the callback returns, then cross-fades the viewport via two pseudo-elements (`::view-transition-old(root)` and `::view-transition-new(root)`).
- The CSS rule in `global.css` tunes duration to ~220 ms; the UA default is 250 ms with ease. `prefers-reduced-motion: reduce` zeroes the animation duration so the swap becomes instant.

## CSS Rule

```css
/* apps/web/src/styles/global.css — appended near the bottom */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 220ms;
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
  }
}
```

These pseudo-elements only exist while a view transition is in flight. The rule is harmless on browsers that don't support View Transitions — selectors that don't match are silently ignored.

## Sidebar.astro Edits

Inputs lose two pieces each:

```diff
- <input type="checkbox" id="theme-toggle" class="theme-controller toggle toggle-xs" value="baseout" aria-label="Toggle theme" />
+ <input type="checkbox" id="theme-toggle" class="toggle toggle-xs" aria-label="Toggle theme" />

- <input type="checkbox" class="theme-controller toggle toggle-xs" value="baseout" aria-label="Toggle theme" data-sidebar-rail-theme />
+ <input type="checkbox" class="toggle toggle-xs" aria-label="Toggle theme" data-sidebar-rail-theme />
```

`<script>` block: the local theme block (today: lines 655–665) collapses to:

```ts
import { wireThemeToggle } from '../../lib/theme';
// ...
function init() {
  // ...existing logout handlers...
  document
    .querySelectorAll<HTMLInputElement>('#theme-toggle, [data-sidebar-rail-theme]')
    .forEach(wireThemeToggle);
  // ...rest of init unchanged...
}
```

`init()` is already re-invoked on `astro:after-swap` (today: line 743), so soft-navigation continues to rebind the (potentially new) toggle instances. `wireThemeToggle` is idempotent — calling it on an already-wired input is a no-op via the `data-theme-wired` sentinel.

## Test Strategy

Behavior in this change is platform-API-driven (View Transitions, `matchMedia`, daisyUI `[data-theme]` swap) and visual. The acceptance check is manual smoke per the Verification section in [tasks.md](./tasks.md). No automated tests are added.

Reasoning:

- The new `theme.ts` module is ~60 LOC of pure DOM glue. Its behaviors (read localStorage, set attribute, dispatch event, wrap in `startViewTransition`) are each one line; unit-testing each would mostly verify the platform APIs.
- daisyUI's CSS-variable swap is verified by visual inspection; an automated assertion that "panel A's `background-color` cross-fades in lockstep with panel B's" is the kind of brittle visual regression a manual smoke handles better.
- The existing FOUC script structure is preserved — only the fallback branch is extended. No regression surface in the soft-nav path.

If theme behavior becomes a first-class capability later (e.g. per-Space theming, custom palette uploads), tests come with that change.

## Browser Support

| Browser | View Transitions | OS preference read | `color-scheme` |
|---|---|---|---|
| Chrome ≥ 111 | ✓ animated cross-fade | ✓ | ✓ |
| Edge ≥ 111 | ✓ animated cross-fade | ✓ | ✓ |
| Safari ≥ 18 | ✓ animated cross-fade | ✓ | ✓ |
| Safari < 18 | ✗ instant snap | ✓ | ✓ |
| Firefox (current) | ✗ instant snap | ✓ | ✓ |

All target browsers reach a flicker-free state; only the animated cross-fade is progressively enhanced.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| The inline FOUC script and `theme.ts` drift apart over time (each owns a copy of "read localStorage with prefers-color-scheme fallback"). | The duplicated logic is two lines and unlikely to evolve. If it grows, refactor by inlining a build-time constant from `theme.ts` via Vite. Out of scope here. |
| `document.startViewTransition` is a recent addition; some TS DOM libs flag it as undefined. | Feature-detect with `typeof document.startViewTransition === 'function'` instead of relying on type assertions. Cast to `any` at the call site if TS complains. |
| daisyUI ships a built-in `theme-controller` behavior we're now bypassing. | The behavior we're removing is the one that caused the redundant-mutation issue (controller fires on `check`, manual handler also fires). Keeping only the manual handler simplifies the data flow without losing functionality (we never relied on the controller's uncheck = no-op semantics). |
| OS preference flips mid-session and confuses the user. | The OS read only happens once at FOUC time when no stored preference exists. Once the user toggles, the choice is persisted and OS changes are ignored until they clear localStorage. Documented in proposal §Out of Scope. |
| `prefers-reduced-motion` user gets a hard snap that feels jarring. | That's the intended behavior — reduced-motion users explicitly opt out of animation, and a hard swap of a theme they triggered is the right UX. |
