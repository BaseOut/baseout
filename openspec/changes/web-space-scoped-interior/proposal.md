## Why

When the user toggles between Spaces in the sidebar dropdown today, **the page interior is stale**. The switch handler at [apps/web/src/components/layout/Sidebar.astro:625-643](../../../apps/web/src/components/layout/Sidebar.astro) does three things:

1. POSTs to `/api/spaces/switch`, which updates `userPreferences.activeSpaceId` and invalidates the server-side session cache ([apps/web/src/lib/session-cache.ts](../../../apps/web/src/lib/session-cache.ts)).
2. Sets `$spaces.activeSpaceId` on the client store ([apps/web/src/stores/spaces.ts](../../../apps/web/src/stores/spaces.ts)).
3. Lets `renderSelectorFromStore()` patch the dropdown pill DOM.

What it does **not** do: trigger any navigation. So the page interior — which was SSR'd from `Astro.locals.account.space.id` at first page load — keeps showing the previous space's data until the user hard-reloads. Diagnosed on 2026-05-12 against the entry-points:

- [apps/web/src/pages/index.astro:20-35](../../../apps/web/src/pages/index.astro) reads `account.space.id` to fetch recent runs.
- [apps/web/src/pages/backups.astro:20-27](../../../apps/web/src/pages/backups.astro) reads `account.space.id` for integrations + runs.
- [apps/web/src/pages/integrations.astro:21-23](../../../apps/web/src/pages/integrations.astro) reads `account.space.id` for connections per space.

Conversely, several pages are **not** space-scoped and **must not re-render** on a space switch: [settings.astro](../../../apps/web/src/pages/settings.astro), [profile.astro](../../../apps/web/src/pages/profile.astro), [help.astro](../../../apps/web/src/pages/help.astro), and the [ops/](../../../apps/web/src/pages/ops/) staff console. A blanket reload-on-switch would interrupt users editing account/profile state.

`<ClientRouter />` is already wired in [apps/web/src/layouts/Layout.astro:37](../../../apps/web/src/layouts/Layout.astro), and the Header at [Header.astro:15](../../../apps/web/src/components/layout/Header.astro) already uses `transition:persist="baseout-topbar"`. The mechanism for surgical interior re-render is already in the codebase — we just need to invoke it from the switch handler, persist the sidebar the same way the header is persisted, and let pages declare whether they care.

## What Changes

- **Add a `spaceScoped?: boolean` prop to [SidebarLayout.astro](../../../apps/web/src/layouts/SidebarLayout.astro)** (default `false`). The layout emits `data-space-scoped="true"` or `"false"` on `<main id="layout-content">`. This is the marker the switch handler reads.

- **Add `transition:persist="baseout-sidebar"` to `<div id="layout-sidebar">`** in `SidebarLayout.astro`, mirroring the existing `topbar` pattern on the Header.

- **Wire `navigate()` into the space-switch handler.** In [Sidebar.astro](../../../apps/web/src/components/layout/Sidebar.astro) `handleSwitch()`: after `POST /api/spaces/switch` succeeds and `$spaces.set(...)` runs, read `document.querySelector('main#layout-content')?.dataset.spaceScoped`. If `'true'`, call `navigate(window.location.pathname + window.location.search)` (import `navigate` from `astro:transitions/client`). If `'false'` (or attribute missing), no navigation — the store update is enough.

- **Page classification** — set `spaceScoped` per page:

  | Path | `spaceScoped` | Reason |
  |------|---|---|
  | `/` (index) | `true` | reads `account.space.id`; lists recent runs |
  | `/backups` | `true` | reads `account.space.id`; integrations + runs |
  | `/integrations` | `true` | reads `account.space.id`; connections per space |
  | `/restore` | `true` | placeholder today; future content is space-scoped |
  | `/schema` | `true` | placeholder today; future content is space-scoped |
  | `/reports` | `true` | placeholder today; future content is space-scoped |
  | `/settings` | `false` | account-level |
  | `/profile` | `false` | user-level |
  | `/help` | `false` | static |
  | `/ops/*` | `false` | staff console |

- **Idempotency guard for the sidebar `init()` block.** With `transition:persist`, the sidebar DOM survives a same-URL nav and `astro:after-swap` re-runs `init()`. If observable double-binding appears in the smoke test, add a `data-sidebar-wired` sentinel on the sidebar root (mirror of the `data-theme-wired` pattern from [web-smooth-theme-swap](../web-smooth-theme-swap/proposal.md)). Otherwise, no guard.

## Out of Scope

- **URL-based space slug** (e.g. `/s/[spaceId]/backups`). Bookmarkable per-space URLs are a different product question; not needed for this change. Largest blast-radius alternative — every route would change shape. Rejected.
- **Per-page client-side refetch without navigation.** Would require rewriting every page's data layer to be client-reactive; would lose the SSR pattern that backs every space-scoped page today. Rejected.
- **Section-root redirect on switch** (e.g. land on `/backups` whenever a switch happens from a deep link). Rejected in the design interview. The destination page handles its own missing-data state (e.g. when `/backups/[runId]` is added in the future, an unknown runId in the new space will surface as an empty/not-found state from the page itself).
- **Changes to `/api/spaces/switch`, `getAccountContext()`, or the `userPreferences` schema.** The server-side switch path is already correct; this change is purely client + layout.
- **Changes to the backup engine (`apps/server/`).** The engine reads `spaceId` from internal API payloads; it has no concept of "active space" and is unaffected.

## Capabilities

UX / front-end behavior change. No new product capability is introduced. No existing spec under [openspec/changes/web/specs/](../web/specs/) describes the space-switch behavior today; no spec delta is added by this change. If review later decides the space-switch experience deserves first-class spec documentation, it can be added under `web/specs/dashboard/` in a follow-up.

## Impact

- **Behavior:** Switching space in the dropdown immediately re-renders the page interior on space-scoped pages (`/`, `/backups`, `/integrations`, and the three placeholders) with the new space's SSR data, while the sidebar and header remain mounted (no flash, no scroll jump). On non-space-scoped pages (`/settings`, `/profile`, `/help`, `/ops/*`), the dropdown updates server state + the client store but the page body does not re-render — the user's in-progress view is preserved.
- **Bundle:** Adds one new prop, one new attribute, one `navigate()` call, and a `transition:persist` directive. No new modules.
- **Markup:** `<main id="layout-content">` gains `data-space-scoped="true|false"`. `<div id="layout-sidebar">` gains `transition:persist="baseout-sidebar"`. Six pages add `spaceScoped` to their `<SidebarLayout>` props.
- **Soft-nav:** Same-URL `navigate()` triggers the standard `astro:before-swap` / `astro:after-swap` lifecycle. The existing [BackupHistoryWidget](../../../apps/web/src/lib/backups/widget-lifecycle.ts) pattern (teardown on `before-swap`, setup on `page-load`) handles this correctly — proven by the live-status work in commit `d19d72b`.
- **Tests:** Vitest unit test for the layout's prop-to-attribute mapping. Vitest unit test for the switch-handler branch (mocked `navigate`, asserts called/not-called/not-called-on-fetch-fail across the three states). No new Playwright tests in this change — the human smoke checklist covers end-to-end flow.
- **Security:** Zero new surface. No new secrets, no new auth path, no new API. The space-switch authorization is unchanged (still gated by `locals.account.organization.id` matching the target Space's org in [api/spaces/switch.ts](../../../apps/web/src/pages/api/spaces/switch.ts)).
- **A11y:** Same as before. The switch button keeps its existing label and disabled-while-pending state. A same-URL view transition is briefer than a full reload — no new motion concerns; respects the global `prefers-reduced-motion` rule already added by [web-smooth-theme-swap](../web-smooth-theme-swap/proposal.md).

## Reversibility

Mechanical. Revert the diff to:

- [apps/web/src/layouts/SidebarLayout.astro](../../../apps/web/src/layouts/SidebarLayout.astro) — drop the `spaceScoped` prop, the `data-space-scoped` attribute on `<main>`, and the `transition:persist="baseout-sidebar"` on `<div id="layout-sidebar">`.
- [apps/web/src/components/layout/Sidebar.astro](../../../apps/web/src/components/layout/Sidebar.astro) — remove the `navigate` import and the navigate call inside `handleSwitch()`. (Optionally remove the `data-sidebar-wired` sentinel if introduced.)
- The six space-scoped page files — remove `spaceScoped={true}` from their `<SidebarLayout>` invocations.

No data migration. No env-var change. No deploy ordering. Local-only revert.
