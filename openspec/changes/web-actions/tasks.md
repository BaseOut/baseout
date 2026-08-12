# web-actions — tasks

## Status

DONE (code) — 2026-08-11. Promoted `ui-only@7502f81`'s Actions landing into the
live app; renamed from the earlier hand-built "web-agents" draft. Gates green;
human browser smoke pending.

## 1. Promote ActionsView (verbatim, self-contained daisyUI)

- [x] 1.1 `apps/web/src/views/ActionsView.astro` — verbatim from
      `ui-only@7502f81` (bespoke = 0: alert · badge · textarea · button · card).
      Header + "Planned" badge, announce block (read-only boundary + Restore/
      Actions exceptions), example list, write-scope explainer, no-JS feedback
      form. `import type { ActionExample } from '../lib/actions'`.
- [x] 1.2 `apps/web/src/lib/actions.ts` — `ACTION_EXAMPLES` (6 drafted proposals)
      + `ActionExample` type, promoted from the fork's `fixtures/actions.ts`.

## 2. Live route + nav

- [x] 2.1 `apps/web/src/pages/actions.astro` — `SidebarLayout` (`spaceScoped`,
      breadcrumbs) + `ActionsView`, fed `ACTION_EXAMPLES`, `?state=` from URL.
      Auto-protected by middleware; no `[space]` segment.
- [x] 2.2 `apps/web/app-config.json` → `navigation.top`: `{ Actions, /actions,
      lucide--square-pen }`. Auto-shows in web + design; breadcrumbs auto-wire.
- [x] 2.3 Deleted the replaced hand-built `apps/web/src/pages/agents.astro`.

## 3. Naming dictionary

- [x] 3.1 `shared/Baseout_Features.md` §1 — **Action** entry (write-to-Airtable
      operation; Restore = other exception; Agent/Workflow/Automation reserved).
- [x] 3.2 Flagged the §7.3-vs-§10 V2-status inconsistency (dict Notes +
      proposal); not resolved here.

## 4. Tests + gates

- [x] 4.1 `src/lib/config.test.ts` — asserts `getNavItems()` has `{ href:
      "/actions", label: "Actions", icon ∋ square-pen }` and
      `getBreadcrumbs('/actions')` → Home › Actions. (updated from the /agents
      RED→GREEN test)
- [x] 4.2 `pnpm --filter @baseout/web typecheck` — no new errors from this change.
- [x] 4.3 `pnpm --filter @baseout/web build` green.
- [x] 4.4 `audit:components` fast half green (stories-coverage +
      component-classification + config = green; ActionsView is a `views/` page,
      not a tracked `ui/*` component, so no story required).

## 5. Ledger

- [x] 5.1 `shared/internal/ui-sync.md` §4 — recorded the ActionsView promotion at
      `ui-only@7502f81`.

## 6. Human smoke

- [ ] 6.1 `pnpm --filter @baseout/web dev` → sign in → sidebar shows "Actions"
      (square-pen) → `/actions` renders the landing → Send flips to the "on the
      list" state → check <375 / <768 / <1024.

## Deferred follow-ups

- [ ] Wire the feedback form to a real POST + store (`action_interest` or an
      existing feedback channel) when persistence lands.
- [ ] Forward-sync the fork's read-only EntityPanel (the other half of
      `7502f81`) — tracked in `design-descriptions-readonly` / `system-sync-skills`.
- [ ] Specs reconcile of the §7.3-vs-§10 "Schema Management Actions" V2 status.
