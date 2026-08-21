# web-cursor-ui-implementation — umbrella proposal

**Branch:** `autumn/cursor-ui-implementation-test` (cut from `origin/main` @ `5ac52dab`, 2026-08-20)  
**Design source of truth:** `ui-only/main` @ `9cf5b1ef`  
**Status:** roadmap **approved** 2026-08-20. Decision: **C → A**. Reports match ui-only; Automations/Interfaces in program. **Do not merge** `web-ui-sync-promotion`.

This change is the **program index** for the full ui-only → Baseout refactor. Per-surface work lives in the child changes listed below. Hard constraints (from the program brief):

1. Storybook / daisyUI components from ui-only only — **no custom components**.
2. Every navigation / click affordance that works in ui-only must work end-to-end in `apps/web` (real data layer; no fixtures in prod).
3. Surfaces that show "coming soon" in Baseout but are built in ui-only **must be built**.
4. Preserve working functionality — refactor/move allowed; do not rebuild what already works as needed.
5. Never `git merge` ui-only (unrelated history). Sync via `/ui-sync` selective copy + ledger update.

---

## Critical base-state finding (decide first)

`main` does **not** contain the 17 promotion commits on `web-ui-sync-promotion`. Those already promote + wire Sources, Destinations, Space Home, Backups, Restore, Auth, Settings, Inbox, Data (browse/attachments/changelog/comments), Reports backend, and the Stage-1 design sync @ `986f6c09`.

| Ref | Role |
|---|---|
| `origin/main` @ `5ac52dab` | This branch's parent — Data still SoonTab shell; no InboxView/SettingsView/LoginView; Settings is pre-hub |
| `web-ui-sync-promotion` (+17) | Most of the refactor already landed + wired; WIP stash also had reports UI + more openspec |
| `ui-only/main` @ `9cf5b1ef` | Design tip — 256 commits past last *committed* sync hash `9a8b448`; 11 commits past Aug-19 triage @ `252005be` (mostly `apps/support` polish) |

**Recommended Phase 0:** merge or cherry-pick `web-ui-sync-promotion` into this branch (preserve working functionality), then forward-sync ui-only delta and execute the remaining child plans. Rebuilding those 17 promotions from `main` would violate constraint 4.

---

## Sync delta snapshot (`pnpm` / `node scripts/ui-sync-status.mjs`)

Relative to last **committed** sync tip `ui-only@9a8b448` → `9cf5b1ef`:

| Bucket | Count | Notes |
|---|---|---|
| never-sync | 12 | `.claude/**`, root lockfile, CI |
| unmapped | ~252 | Mostly net-new `apps/support/**` + `audit/**` + `brand/baseout-bridge.css` + fork root docs |
| design harness | 53 | fixtures, design pages, storybook.ts |
| web layer | ~182 | views/components/lib/styles to localize → design then promote → web |
| openspec (fork) | support-portal research refresh, usage-and-billing, etc. |

Post-pull drift hook also reported **42 diverged**, **8 reverse-pending**, **192 forward-pending** — reconcile reverse/diverged before blind forward sync (`/sync-reconcile`).

---

## Child implementation plans (filed)

| Change | Surface | Gate / notes |
|---|---|---|
| [`support`](../support/) | Net-new Support portal (`apps/support`) | **Blocked on client Q#6** (does a support channel exist?) |
| [`web-data-docs-chat`](../web-data-docs-chat/) | Data ▸ Docs + Chat — un-gate SoonTabs | Backends claimed present; replace SoonTab with ui-only panels + real wiring |
| [`web-auth-convergence`](../web-auth-convergence/) | Login/Welcome convergence leftovers + ship item 1 (unsubmittable auth form) | Depends on Auth promotion being on the branch |
| [`web-design-audit-convergence`](../web-design-audit-convergence/) | 41-item design-audit ship order | Includes `PanelHost.astro` (only web file in `252005be`→ delta at triage time) |
| [`web-billing-usage`](../web-billing-usage/) | Billing / usage | **Blocked on client Q#4** + no fork usage design yet |
| [`system-spec-handoff`](../system-spec-handoff/) | Spec-handoff skill for surfaces the fork lacks | Process, not a product surface |

### Existing OpenSpec children to reconcile (already on main / promotion)

| Change | Role in this program |
|---|---|
| `web-reports-page` | Promote Reports UI from ui-only; backend landed on promotion (`4d3ff862`). Tasks on main still show "Not started" — stale vs promotion. |
| `web-automations-interfaces-tabs` | Schema Automations + Interfaces — ui-only built; main still SoonTab; **needs engine routes** |
| `web-settings` | Was promotion-only; remaining gated Settings rows (§5) |
| `web-schema-*` / Schema re-arch | **Deferred** (ledger decision 2026-08-14) — do not full-rebuild live Schema shell; Automations/Interfaces stay their own track |
| `web-notifications-inbox` | Full-page `/inbox` on promotion; dropdown already on main lineage via earlier work |

---

## Suggested program phases (for Plan mode)

0. **Absorb promotion branch** — bring `web-ui-sync-promotion` onto this branch; drop duplicate rebuilds.
1. **Reconcile drift** — `/sync-reconcile` on diverged + reverse-pending; then Stage-1 `/ui-sync` to `apps/design` at `9cf5b1ef` + ledger row.
2. **Close SoonTabs that ui-only already built** — Data Docs/Chat; Schema Automations/Interfaces (full-stack); Reports UI; any remaining Settings gates that have backends.
3. **Support portal** — land `apps/support` once Q#6 answered (or interim: retarget CTAs / delete placeholder per audit).
4. **Design-audit convergence** — ship-order items 1→41 under Storybook/daisyUI-only rule.
5. **Billing/usage** — only after Q#4 + a real fork design (or honest gate).
6. **Verification** — per-surface: `audit:components`, unit tests, typecheck/build, must-refresh poll, mobile breakpoints; no fixtures in prod; every ui-only click path exercised.

---

## Out of scope (explicit)

- `apps/prelaunch`, `apps/survey` (Aug-19 scoping)
- Blind Schema component re-architecture while live shell works
- Custom components outside Storybook catalog / daisyUI
- Merging ui-only git history
- Auto-push to `ui-only`

---

## Open decisions for Plan mode

1. Absorb `web-ui-sync-promotion` vs rebuild from main?
2. Is Schema Automations/Interfaces in this program's critical path, or stays deferred until `server-*` routes exist?
3. Support portal: wait on Q#6, or ship docs-only interim?
4. Commit these plan artifacts on this branch now, or keep uncommitted until the program plan is approved?
