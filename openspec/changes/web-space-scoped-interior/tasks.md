## 1. Add `spaceScoped` prop to SidebarLayout

- [x] 1.1 Edit [apps/web/src/layouts/SidebarLayout.astro](../../../apps/web/src/layouts/SidebarLayout.astro):
  - Add `spaceScoped?: boolean` to the `Props` interface (default `false`).
  - On `<main id="layout-content">` emit `data-space-scoped={spaceScoped ? 'true' : 'false'}`.
- [x] 1.2 Add `transition:persist="baseout-sidebar"` to `<div id="layout-sidebar">` in the same file (mirror of the existing `transition:persist="baseout-topbar"` on Header).

## 2. Tests — red phase first

Per CLAUDE.md §3.4 (TDD). Tests fail before any handler-side wiring.

- [~] 2.1 SidebarLayout render test — **skipped**. The mapping is a single ternary on a Cloudflare-bound layout (`Astro.locals.account` etc.). The Astro Container API would require stubbing the entire request context for what is a one-line attribute. Smoke step 7.1/7.3 covers the user-visible contract end-to-end; reading the wrong attribute name in the handler is caught by §2.2. If the layout test is later judged worth the setup cost, it can be added.
- [x] 2.2 Extracted the handler to [src/lib/sidebar/space-switch.ts](../../../apps/web/src/lib/sidebar/space-switch.ts) and added [src/lib/sidebar/space-switch.test.ts](../../../apps/web/src/lib/sidebar/space-switch.test.ts) (happy-dom). Covers: fetch ok + `data-space-scoped="true"` → navigate called once with `pathname + search`; `data-space-scoped="false"` → no navigate; attribute missing → no navigate; fetch non-ok → no store mutation, button re-enabled; no-ops on already-disabled button and already-active space; in-flight disabling.
- [x] 2.3 Red phase confirmed (module missing → import-resolve failure); green phase 416/416.

## 3. Wire `navigate()` into the switch handler

- [x] 3.1 Edited [apps/web/src/components/layout/Sidebar.astro](../../../apps/web/src/components/layout/Sidebar.astro):
  - Imported `navigate` from `astro:transitions/client` and `handleSpaceSwitch` from `../../lib/sidebar/space-switch`.
  - Replaced the inline `handleSwitch(...)` declaration with a call to `handleSpaceSwitch(switchBtn, { navigate })` inside the existing delegated click handler. The data-space-scoped check now lives in the testable module.
- [x] 3.2 `pnpm test:unit` → 416/416.

## 4. Verify sidebar `init()` idempotency under persist

- [ ] 4.1 During §6 smoke, watch for double-fire (two POSTs on one click, doubled `BackupHistoryWidget` polling, duplicate dropdown-toggle handlers).
- [ ] 4.2 **Only if double-fire is observed**: add a `data-sidebar-wired` sentinel — set on the sidebar root inside `init()`; early-return if already set. Mirror of the `data-theme-wired` pattern from [web-smooth-theme-swap](../web-smooth-theme-swap/tasks.md). Skip this step if smoke is clean.

## 5. Mark space-scoped pages

- [x] 5.1 Passed `spaceScoped={true}` to `<SidebarLayout>` in:
  - [apps/web/src/pages/index.astro](../../../apps/web/src/pages/index.astro)
  - [apps/web/src/pages/backups.astro](../../../apps/web/src/pages/backups.astro)
  - [apps/web/src/pages/integrations.astro](../../../apps/web/src/pages/integrations.astro)
  - [apps/web/src/pages/restore.astro](../../../apps/web/src/pages/restore.astro)
  - [apps/web/src/pages/schema.astro](../../../apps/web/src/pages/schema.astro)
  - [apps/web/src/pages/reports.astro](../../../apps/web/src/pages/reports.astro)
- [x] 5.2 Left `settings.astro`, `profile.astro`, `help.astro`, `ops/index.astro` unchanged.

## 6. Type-check, build, lint diff

- [x] 6.1 `pnpm typecheck` (in `apps/web`) — 0 errors, 0 warnings, 4 pre-existing hints unrelated to this change.
- [x] 6.2 `pnpm build` — clean.
- [x] 6.3 `pnpm test:unit` — 416/416 passing (was 409 before adding the 7 handler tests).
- [x] 6.4 `git diff -U0 -- apps/web | grep -E '^\+.*(console\.(log|debug|info|warn|error|trace)|debugger)'` returns nothing.

## 7. Manual smoke (human-in-the-loop)

Per the user's standing workflow (`feedback_no_prs_human_test_then_local_commit.md`): the agent implements and surfaces the dev command; the human runs the smoke checklist and approves before any commit lands locally; no PR is opened.

Surface this command for the human tester:

```
pnpm --filter @baseout/web dev
```

Smoke checklist (human runs; the user must have at least two Spaces in their Org — create a second one via the `+` button in the sidebar dropdown if needed):

- [ ] 7.1 On `/backups`: open the space dropdown, switch to the other space. The sidebar (nav items, org pill, space list) does **not** flash or reflow. The header does not reflow. The backup history table and integration cards re-render with the new space's data. URL stays at `/backups`.
- [ ] 7.2 Repeat 7.1 on `/integrations` and `/` (dashboard).
- [ ] 7.3 On `/settings`: switch space. Settings card does **not** re-render. The sidebar's space-pill name updates. No flicker in the page body. Manually click into `/backups` afterward — confirms the server-side switch landed (you see the new space's data on arrival).
- [ ] 7.4 Repeat 7.3 on `/profile` and `/help`.
- [ ] 7.5 Switch space, then immediately switch back. No double-fire, no stuck spinner, no stale data, no doubled `BackupHistoryWidget` polling cadence.
- [ ] 7.6 Hard-reload after a switch. Page comes back showing the chosen space (proves `userPreferences.activeSpaceId` was persisted, not just held in memory).
- [ ] 7.7 Simulate `/api/spaces/switch` failure (DevTools → Network → block request URL). Click a switch button → button briefly disables and re-enables; no navigation occurs; the store stays on the old space; sidebar pill stays on the old name.
- [ ] 7.8 On `/backups`, click switch and observe `BackupHistoryWidget` in DevTools (network or console). The `astro:before-swap` teardown fires (polling stops); `astro:page-load` setup runs again (polling restarts for the new space). No leaked interval.
- [ ] 7.9 Soft-nav between `/` → `/backups` → `/integrations` after a switch. Sidebar + Header continue to persist (no flash, no scroll reset). Each landing page shows the new space's data.
- [ ] 7.10 Open in Firefox (no native View Transitions API). Switch behavior still works — `navigate()` falls back to a non-animated swap. No regression.
- [ ] 7.11 (only if double-fire observed in 7.5 / 7.8) After applying the §4 sentinel, re-run 7.1, 7.5, and 7.8.

## 8. Commit and close

- [ ] 8.1 After the human confirms the smoke checklist, stage only the files listed in [proposal.md](./proposal.md) §What Changes. Do not stage drive-by edits.
- [ ] 8.2 Commit locally with a message that names the user-visible outcome (space switch re-renders page interior; sidebar/header persist).
- [ ] 8.3 Do **not** push. Do **not** open a PR. Per `feedback_no_prs_human_test_then_local_commit.md`.
- [ ] 8.4 Archive this change via `/opsx:archive web-space-scoped-interior` once committed.
