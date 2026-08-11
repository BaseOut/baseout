## 1. Scaffold the theme module

- [ ] 1.1 Create [apps/web/src/lib/theme.ts](../../../apps/web/src/lib/theme.ts) exporting `ThemeMode`, `getInitialTheme`, `applyTheme(mode, options?)`, and `wireThemeToggle(input)`. Logic per [design.md](./design.md) §Module API + §View Transitions Pattern. Use a `data-theme-wired` sentinel attribute to make `wireThemeToggle` idempotent across `astro:after-swap` rebinds.

## 2. Update Layout.astro

- [ ] 2.1 Edit [apps/web/src/layouts/Layout.astro](../../../apps/web/src/layouts/Layout.astro):
  - On `<html>`: add `style="color-scheme: light dark"` (keep existing `lang`, `data-theme`, `data-font-family`, `class`).
  - In the inline `<script is:inline>`: replace `localStorage.getItem('theme') || 'light'` with the OS-preference fallback per [design.md](./design.md) §Inline FOUC Script. Both initial-load and `astro:after-swap` branches.
  - On `<body>`: remove `transition-colors duration-300` from the class list. Keep `font-sans text-base-content antialiased`.

## 3. Update Sidebar.astro

- [ ] 3.1 Edit [apps/web/src/components/layout/Sidebar.astro](../../../apps/web/src/components/layout/Sidebar.astro):
  - Line ~422 (`id="theme-toggle"` input): remove `class="theme-controller "` prefix (keep `toggle toggle-xs`) and remove `value="baseout"`.
  - Line ~489 (`data-sidebar-rail-theme` input): same removals.
- [ ] 3.2 In the same file's `<script>` block (~line 500): add `import { wireThemeToggle } from '../../lib/theme';` to the existing import group.
- [ ] 3.3 Inside `init()` (~lines 655–665): delete the inline `themeToggles` / `applyTheme` block and replace with:
  ```ts
  document
    .querySelectorAll<HTMLInputElement>('#theme-toggle, [data-sidebar-rail-theme]')
    .forEach(wireThemeToggle);
  ```

## 4. Append the view-transition CSS rule

- [ ] 4.1 Append to [apps/web/src/styles/global.css](../../../apps/web/src/styles/global.css) the `::view-transition-old(root)` / `::view-transition-new(root)` duration rule + the `prefers-reduced-motion` no-op per [design.md](./design.md) §CSS Rule. Place near the end of the file so it doesn't disturb existing import ordering.

## 5. Type-check and build

- [ ] 5.1 `pnpm --filter @baseout/web typecheck` — clean.
- [ ] 5.2 `pnpm --filter @baseout/web build` — clean, no new lint or build errors.
- [ ] 5.3 Diff grep: `git diff -U0 -- apps/web | grep -E "console\.(log|debug|info|warn|error|trace)|debugger"` returns nothing (per [CLAUDE.md](../../../CLAUDE.md) §3.5).

## 6. Manual smoke (human-in-the-loop)

Per the user's standing workflow (`feedback_no_prs_human_test_then_local_commit.md`): the agent implements and surfaces the dev command; the human runs the smoke checks and approves before any commit lands locally; no PR is opened.

Surface this command for the human tester:

```
pnpm --filter @baseout/web dev
```

Smoke checklist (human runs):

- [ ] 6.1 Toggle light → dark and dark → light in the main sidebar several times. The whole viewport cross-fades in one paint; no panel/border/text snaps out of sync.
- [ ] 6.2 Open the collapsed-rail variant. Toggle there. Both toggles stay in sync, no double-paint.
- [ ] 6.3 Soft-nav between dashboard pages (`/`, `/backups`, `/integrations`) via in-app links. Theme persists; no FOUC on the new page.
- [ ] 6.4 Hard-reload in dark mode. First paint is already dark; no flash to light.
- [ ] 6.5 Clear `localStorage.theme` (DevTools → Application → Local Storage → delete). Set macOS to **Dark**. Reload → app renders dark. Set macOS to **Light**. Reload → app renders light.
- [ ] 6.6 In DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce". Toggle → swap is instant, no animation.
- [ ] 6.7 Open in Firefox. Toggle → swap is instant (no View Transitions support), still no trickle.
- [ ] 6.8 Open a `<select>` (e.g. the settings page) in dark mode. The native dropdown chrome and the page scrollbar follow the dark palette (proves `color-scheme: light dark`).

## 7. Commit and close

- [ ] 7.1 After the human confirms the smoke checklist, stage only the files listed in [proposal.md](./proposal.md) §What Changes. Do not stage drive-by edits.
- [ ] 7.2 Commit locally with a message that names the user-visible outcome (smooth theme swap, OS-preference default).
- [ ] 7.3 Do **not** push. Do **not** open a PR. Per `feedback_no_prs_human_test_then_local_commit.md`.
- [ ] 7.4 Archive this change via `/opsx:archive web-smooth-theme-swap` once committed.
