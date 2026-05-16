## Overview

Make the page interior re-render with the new active Space when the user toggles the sidebar dropdown, by triggering a same-URL ClientRouter navigation from the existing switch handler. The Sidebar and Header survive the swap via `transition:persist`. Pages that are not space-scoped opt out via a `spaceScoped` prop on `SidebarLayout`, which emits a `data-space-scoped` attribute that the handler reads before deciding whether to navigate.

## Stack

| Concern | Choice | Note |
|---|---|---|
| Switch mechanism | `navigate()` from `astro:transitions/client` on same URL | Standard Astro view-transition entrypoint. Already enabled via `<ClientRouter />` in [Layout.astro:37](../../../apps/web/src/layouts/Layout.astro). |
| Per-page opt-in | `spaceScoped?: boolean` prop on `SidebarLayout` → `data-space-scoped="true|false"` on `<main id="layout-content">` | Default `false`. One place to decide, one place to read. |
| Survival across swap | `transition:persist="baseout-sidebar"` on `<div id="layout-sidebar">` | Mirrors `transition:persist="baseout-topbar"` already on [Header.astro:15](../../../apps/web/src/components/layout/Header.astro). |
| Active-space resolution | `Astro.locals.account.space.id` via `getAccountContext()` per-request | Unchanged. Middleware already invalidates `SESSION_CACHE` on switch, so the next SSR resolves the new `activeSpaceId`. |
| Client store | `$spaces` atom at [stores/spaces.ts](../../../apps/web/src/stores/spaces.ts) | Unchanged. Still updated immediately after the switch POST so the sidebar pill reflects the chosen space before nav completes. |
| Idempotency guard | `data-sidebar-wired` sentinel on the sidebar root, **only if double-binding is observed** | Mirrors `data-theme-wired` from [web-smooth-theme-swap](../web-smooth-theme-swap/design.md). Defer until smoke verifies. |
| Test infra | Vitest with happy-dom | Per CLAUDE.md §3.4. The handler-branch test mocks `navigate` and the fetch call. |

## Source Layout

```
apps/web/
├── src/
│   ├── layouts/
│   │   └── SidebarLayout.astro            # NEW prop spaceScoped (default false);
│   │                                      #   emits data-space-scoped on <main>;
│   │                                      #   adds transition:persist="baseout-sidebar" on <div id="layout-sidebar">.
│   ├── components/layout/
│   │   └── Sidebar.astro                  # handleSwitch() reads data-space-scoped
│   │                                      #   then conditionally calls navigate(pathname + search).
│   │                                      #   New import: `navigate` from 'astro:transitions/client'.
│   └── pages/
│       ├── index.astro                    # spaceScoped={true}
│       ├── backups.astro                  # spaceScoped={true}
│       ├── integrations.astro             # spaceScoped={true}
│       ├── restore.astro                  # spaceScoped={true}
│       ├── schema.astro                   # spaceScoped={true}
│       ├── reports.astro                  # spaceScoped={true}
│       ├── settings.astro                 # (default false — unchanged)
│       ├── profile.astro                  # (default false — unchanged)
│       └── help.astro                     # (default false — unchanged)
```

`/ops/index.astro` keeps the default `false` — staff console is not space-scoped.

## Sequence Diagram (the switch path)

```
User clicks [data-space-switch] for spaceId=B (was A)
       │
       ▼
Sidebar.astro:handleSwitch(btn)
       │
       ▼
btn.disabled = true            ──► visual "in-flight" state
       │
       ▼
POST /api/spaces/switch  body={spaceId: B}
       │
       ▼  (server)
   /api/spaces/switch.ts
       │ - verify Space B belongs to current Org
       │ - UPDATE userPreferences SET activeSpaceId=B
       │ - invalidateSessionCache(sessionToken)
       │ - 200 OK
       ▼  (client, back in handleSwitch)
res.ok? ── no ──► btn.disabled = false; return  (no nav, no store change)
       │ yes
       ▼
$spaces.set({ ...prev, activeSpaceId: B })   ──► Sidebar pill re-renders (existing subscriber)
       │
       ▼
const main = document.querySelector('main#layout-content')
const scoped = main?.dataset.spaceScoped === 'true'
       │
       ▼
scoped? ── no ──► return  (settings/profile/help/ops: store update is enough)
       │ yes
       ▼
navigate(window.location.pathname + window.location.search)
       │
       ▼  (Astro ClientRouter)
astro:before-swap   ──► widgets teardown (BackupHistoryWidget stops polling, etc.)
       │
       ▼  (new SSR request to same URL)
middleware re-runs → getAccountContext() resolves account.space.id = B
       │
       ▼  page frontmatter re-runs with new spaceId
       │  (e.g. backups.astro fetches integrations + runs for B)
       │
       ▼
astro:after-swap    ──► <main> swapped; Sidebar + Header NOT swapped (transition:persist)
       │
       ▼  widgets re-init (BackupHistoryWidget subscribes + polls for B)
```

## Why `transition:persist` Survives Same-URL Nav

`transition:persist` is matched by the `transition:name` (or the value supplied to `transition:persist`) on both the outgoing and incoming DOM. Astro's ClientRouter pairs them and reuses the existing element in place of the freshly-fetched one. The pairing rule is independent of the URL — same-URL navs work the same as different-URL navs. We've already proven this with the Header (`topbar`) across every existing in-app navigation; the only difference here is that the navigation target equals the current pathname.

Because the sidebar element is reused, any state attached to its DOM (open/closed dropdown, hover state, the space pill text patched by `renderSelectorFromStore()`) survives intact. Astro re-fires `astro:after-swap`, which the sidebar's existing module-level listener uses to re-run `init()`.

## Idempotency Decision: `data-sidebar-wired` Sentinel

`Sidebar.astro`'s `init()` (lines ~635–735) runs at module load and again on every `astro:after-swap`. With `transition:persist`, the same DOM element exists across swaps, so the same listeners are attached twice unless `init()` is idempotent.

Two paths considered:

1. **Add the sentinel preemptively** — set `data-sidebar-wired="true"` on a stable root element inside `init()`; return early if already set. Robust but adds code for a problem we haven't observed.
2. **Defer the sentinel** — ship without a guard and verify in the smoke test. Listeners attached with `addEventListener` to the *same* function reference are deduplicated by the DOM; listeners attached with fresh closures are not. The current `init()` uses fresh closures, so double-binding is plausible but not certain.

Decision: **defer**. Add the sentinel only if the smoke test reveals a double-fire (e.g. clicking a space-switch button triggers two POSTs, or the polling cadence of `BackupHistoryWidget` doubles). The corresponding tasks line item is conditional.

## Page Classification Rule

A page is space-scoped iff its current or near-future SSR fetch reads `account.space.id`. Today, three pages do this (`/`, `/backups`, `/integrations`). Three more are placeholders whose intended content (per [shared/Baseout_PRD.md](../../../shared/Baseout_PRD.md)) is space-scoped (`/restore`, `/schema`, `/reports`); marking them `spaceScoped={true}` now avoids a follow-up edit when their content lands. Account-level (`/settings`), user-level (`/profile`), static (`/help`), and staff (`/ops/*`) pages stay at the default `false`.

If a future page is space-scoped but the author forgets to pass `spaceScoped={true}`, the user-visible failure mode is the original bug: stale data on switch. There is no silent data-corruption path.

## Failure Modes

| Failure | Behavior | Recovery |
|---|---|---|
| `POST /api/spaces/switch` returns non-2xx | `res.ok` is false; handler re-enables the button and returns without mutating the store or calling `navigate`. User stays on old space. | User can retry. |
| `POST` succeeds but `navigate()` throws (e.g. ClientRouter not yet ready, network failure on SSR) | Store still reflects new space; sidebar pill says B; page body still shows A. | User can manually reload the page (URL is unchanged); next reload SSRs space B because the server change already landed. |
| `data-space-scoped` attribute missing entirely (page forgot to set the prop, or rendered before layout hydration) | Treated as non-space-scoped: no navigation. | Page reload will pick up new space; or page author adds the prop. |
| User on `/backups/[runId]` (future route) switches to a space without that runId | `navigate()` proceeds to same URL; SSR returns the page's empty/not-found state for that runId in the new space's context. | Page-level UX — out of scope for this change. |
| `astro:before-swap` widget teardown fails | The next `astro:page-load` setup still runs; widget may leak a single interval for one cycle. | Bug in the affected widget, not in this change. |

## Test Plan

**Unit (Vitest with happy-dom or component test):**

- `SidebarLayout.astro` with `spaceScoped={true}` renders `<main>` with `data-space-scoped="true"`; with `spaceScoped={false}` or omitted, renders `data-space-scoped="false"`.
- `handleSwitch` branch table — mock `fetch` and `navigate`:
  - fetch ok + `data-space-scoped="true"` → `navigate` called once with `pathname + search`.
  - fetch ok + `data-space-scoped="false"` → `navigate` NOT called.
  - fetch ok + attribute missing → `navigate` NOT called.
  - fetch !ok → `navigate` NOT called, `$spaces` NOT mutated, button re-enabled.

**Integration / smoke (human-in-the-loop):**

See `tasks.md` §6 (the smoke checklist). Covers cross-page behavior, BackupHistoryWidget lifecycle, persistence across hard-reload, and Firefox (no native View Transitions API).

## What This Change Does Not Touch

- `apps/server/` — engine ignores active-space; no changes needed.
- `/api/spaces/switch` — already correct.
- `getAccountContext()` / `userPreferences` schema — unchanged.
- `$spaces` store shape — unchanged.
- The space-creation flow (`refreshSpaces()` at [stores/spaces.ts:16-24](../../../apps/web/src/stores/spaces.ts)) — unchanged; new spaces are still added to the dropdown reactively.
- Auth, billing, theme, sidebar layout, breadcrumbs — unchanged.
