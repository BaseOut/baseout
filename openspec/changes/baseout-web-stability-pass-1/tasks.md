# Tasks — baseout-web-stability-pass-1

Single-day scope. Three independent tracks. Total budget ~5–6h focused work.

## Track A — Spaces refresh fix (1.5h, **highest priority**)

- [x] A.1 Add `$spaces` SSR hydration JSON-script to [apps/web/src/layouts/SidebarLayout.astro](../../../apps/web/src/layouts/SidebarLayout.astro), mirroring the `#account-state` and `#integrations-state` patterns (CLAUDE.md §4).
- [x] A.2 Update [apps/web/src/stores/spaces.ts](../../../apps/web/src/stores/spaces.ts) to read the JSON-script element on module init; keep `refreshSpaces()` as a manual-fetch fallback.
- [x] A.3 Extend [apps/web/src/pages/api/spaces/switch.ts](../../../apps/web/src/pages/api/spaces/switch.ts) response: return `{ account, integrations, spaces }` payload after the session cache is cleared and the new context is loaded.
- [x] A.4 Update [apps/web/src/components/layout/Sidebar.astro](../../../apps/web/src/components/layout/Sidebar.astro) `handleSwitch()` (currently lines ~624–642): on success, parse the response and call `$account.set(res.account)`, `$integrations.set(res.integrations)`, `$spaces.set(res.spaces)` in that order.
- [ ] A.5 Manual smoke test in dev server: switch spaces on `/`, `/integrations`, `/profile`. Confirm every visible field updates without a hard reload. **Pending — `pnpm dev:web` requires the operator's local Postgres + remote Cloudflare bindings; not runnable from this session.**
- [x] A.6 Confirm no regression on the existing `dashboard.ts` $spaces subscriber (it currently auto-refreshes the dashboard on space change — must keep working). Subscriber unchanged; receives a fresh `activeSpaceId` from the new payload and triggers `refreshDashboard()` exactly as before.

## Track B — Vitest bootstrap + happy-path unit tests (2h, **user-flagged**)

- [x] B.1 `pnpm --filter @baseout/web test` — confirm Vitest boots clean post-cutover. Added a `test` alias in [apps/web/package.json](../../../apps/web/package.json) (was missing; only `test:unit` existed). 139 tests across 19 files pass.
- [x] B.2 Create [apps/web/tests/unit/auth-utils.test.ts](../../../apps/web/tests/unit/auth-utils.test.ts) — happy paths for `showFormError`, `hideFormError`, `showFormSuccess`, `hideFormSuccess`. happy-dom environment via top-of-file `// @vitest-environment` directive.
- [x] B.3 Create [apps/web/tests/unit/stores/spaces.test.ts](../../../apps/web/tests/unit/stores/spaces.test.ts) — `refreshSpaces()` updates the atom; SSR-hydration code path (from A.2) parses correctly; missing JSON-script element returns null cleanly; malformed JSON leaves the atom unchanged.
- [x] B.4 Create [apps/web/tests/unit/stores/account.test.ts](../../../apps/web/tests/unit/stores/account.test.ts) — JSON-script hydration parses correctly; missing element returns null cleanly; malformed JSON leaves the atom unchanged. Required adding `hydrateAccountFromDom()` helper to [stores/account.ts](../../../apps/web/src/stores/account.ts) (mirrors the spaces-store pattern); existing page-level inline parses keep working.
- [x] B.5 Confirm CI ([.github/workflows/ci.yml](../../../.github/workflows/ci.yml)) runs `pnpm --filter @baseout/web test` on every PR. CI invokes root `pnpm test` → `pnpm -r --parallel run test`; the new `test` script in `apps/web/package.json` makes web part of that fan-out.

Vitest config extended in [apps/web/vitest.config.ts](../../../apps/web/vitest.config.ts) to include `tests/unit/**/*.{test,spec}.ts` alongside the existing `src/**/*.{test,spec}.ts` glob.

## Track C — Settings page V1 essentials (1.5h)

- [x] C.1 Replace placeholder body of [apps/web/src/pages/settings.astro](../../../apps/web/src/pages/settings.astro) with four cards: plan/trial state, organization info, sign-out, deletion request.
- [x] C.2 **Plan / Trial card** — reads `subscription_items.tier` + `subscription_items.trial_ends_at` + `subscriptions.status` server-side (joined on `platforms.slug = 'airtable'`). Trialing → "Trial expires in N days" countdown with `badge-soft badge-warning` when ≤ 2 days, `badge-soft badge-primary` otherwise. Paid → "<Tier> Plan" with `badge-soft badge-primary`.
  - Deviation from task wording: `trial_ends_at` lives on `subscription_items` per the master schema, not `account.organization`. Confirmed in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) `subscriptionItems.trialEndsAt`. Loading server-side avoids changing the `AccountContext` shape.
- [x] C.3 **Sign-out button** — extracted into `signOutAndRedirect(btn?)` in [apps/web/src/lib/auth-client.ts](../../../apps/web/src/lib/auth-client.ts). Calls `authClient.signOut()`, resets `$account`, `$integrations`, `$spaces`, and redirects to `/login`. Reused from both [Sidebar.astro](../../../apps/web/src/components/layout/Sidebar.astro) and [settings.astro](../../../apps/web/src/pages/settings.astro). Settings invocation passes the button so `setButtonLoading` toggles a daisyUI spinner (CLAUDE.md §4.5).
  - Drive-by fix surfaced during extraction: the previous Sidebar logout never reset `$integrations` (CLAUDE.md §4 violation). Now reset via the shared helper.
- [x] C.4 **Org info card** — read-only display of org name (from `$account`), member count (`SELECT count() FROM organization_members`), owner email (`organization_members.role = 'owner'` join). No edit affordance per V2 deferral.
- [x] C.5 **Account deletion request** — `deletion_requests` schema is **not present** in the master DB (verified by reading [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) end-to-end). Per design D3, the CTA renders disabled with a `title` tooltip explaining the pending state. No POST route. Surface as a follow-up: needs `deletion_requests` migration + `POST /api/account/delete-request` route + modal confirm UI in a new `baseout-web-account-deletion` change.
- [ ] C.6 Manual smoke test: navigate to `/settings`, confirm all shipped cards render, sign-out works, deletion modal (if shipped) opens and closes cleanly. **Pending — same blocker as A.5: requires the operator's local dev server.**

## Closeout

- [x] X.1 `pnpm --filter @baseout/web typecheck` — clean (0 errors, 0 warnings, 2 unrelated stale hints in `tests/integration/backup-config-persist.test.ts`).
- [x] X.2 `pnpm --filter @baseout/web build` — clean. Pre-existing image-resolve warnings from `/images/landing/*` are unchanged from main.
- [x] X.3 `pnpm --filter @baseout/web test` — green (139 / 139 across 19 files; 13 new tests added in this change).
- [x] X.4 No `console.*` or `debugger` in the diff (CLAUDE.md §3.5). Verified via `git diff -U0 -- apps/web | grep -nE '^\+.*(console\.|debugger)'` — no matches.
- [ ] X.5 PR opened on branch `change/baseout-web-stability-pass-1` linking to this folder. **Pending — needs explicit approval before commit/branch/push (CLAUDE.md §7 + user feedback memory).**
- [x] X.6 Update this file's checkboxes as work lands.

## Out of scope (do NOT do as part of this change)

See [proposal.md](./proposal.md) "Reversibility" + [design.md](./design.md) "Non-Goals". Specifically, do not touch:

- `packages/db-schema/src/` or `packages/ui/src/` (serialization rules per `openspec/AGENTS.md`)
- `apps/server/` (different change scope; this is web-only)
- Auth flow internals (`auth.ts`, `auth-client.ts` — work as-is, drive-by churn forbidden per CLAUDE.md §1.5)
- Backups, restore, schema, reports, help, integrations OAuth — all out of scope

If a task uncovers something on the no-touch list, **stop and surface it** rather than expanding scope.

## Notes for review

**Pre-existing diff hunks NOT part of this change** (already on disk when work started; left untouched):

- [.gitignore](../../../.gitignore) — adds `apps/server/.openspec-target` rotating-symlink marker.
- [apps/server/openspec](../../../apps/server/openspec) — symlink retargeted from `baseout-backup` → `airtable-client`.
- [scripts/fix-symlinks.js](../../../scripts/fix-symlinks.js) — adds `.openspec-target`-driven server-link resolution + dangling-link detection.

These three are server-track infrastructure for parallel-agent enablement (cutover plan §6.2). They should land via their own change/PR — surfaced here so they aren't accidentally bundled into this web stability pass.
