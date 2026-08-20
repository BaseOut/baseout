# UI Implementation Roadmap — `autumn/cursor-ui-implementation-test`

> **Status:** roadmap **approved** 2026-08-20 — implementation may begin at Phase 0 / Slice A  
> **Decision locked:** C (full inventory) → then A (SoonTab un-gates as slice 1)  
> **Base:** `origin/main` @ `5ac52dab` · **Design tip:** `ui-only/main` @ `9cf5b1ef`  
> **Do not** merge or branch from `web-ui-sync-promotion` (reference-only if useful later)  
> **Product calls:** Reports **match ui-only** (overturn V1 trim) · Schema Automations/Interfaces **in program** · plans commit on this branch

**Goal:** Make `apps/web` match ui-only navigation and interaction, with a real data layer, Storybook/daisyUI only, preserving working behavior on `main`.

**Architecture:** Per-surface OpenSpec changes. Sync designs via `/ui-sync` (never merge ui-only). Promote views with real SSR/proxies; honest gates only where backend or product scope truly blocks.

**Constraints:**
- Storybook catalog / daisyUI only — no custom components
- No prod fixtures; ui-only click paths must work end-to-end when built
- Don’t rebuild trusted working surfaces — refactor/move OK
- `web-ui-sync-promotion` is saved for later review, not a merge source

---

## 1. Surface inventory (main vs ui-only)

### Legend
| Tag | Meaning |
|---|---|
| **LIVE** | Built on main with real data |
| **SOON** | Tab/route exists; `SoonTab` or “coming soon” placeholder |
| **BUILT (ui-only)** | Designed + interactive in ui-only (fixtures) |
| **HONEST** | Coming-soon is correct product scope (V2 / unreleased provider) — do **not** fake-build |
| **BLOCKED** | Needs client answer or unbuilt engine |
| **SCOPE CONFLICT** | main deliberately hid/redirected; ui-only still shows it |

### Space navigation

| Surface | main today | ui-only | Backend on main | Program action |
|---|---|---|---|---|
| Home | **LIVE** (`SpaceHomeView` · Phase 7.4 visual) | Built | runs + integrations | **DONE** visual — preserve `index.astro` poll |
| Backups | **LIVE** (`BackupsListView` · Phase 7.5 visual) | Built | engine runs | **DONE** visual — preserve `backups.astro` poll |
| Restore | **LIVE** | Built | restore paths | Later visual sync |
| Schema — Browse / Visualize / Relationships / Health / Docs / Chat / Changelog* | **LIVE** (most tabs) | Re-architected (deferred) | yes | **Keep live shell**; Schema re-arch deferred (ledger) |
| Schema — Automations / Interfaces | **LIVE** (Phase 9) | **BUILT** | manual-CRUD engine + proxies | **DONE** — tabs + Drawer CRUD; MCP capture funnel still deferred |
| Data — Browse / Changelog / Comments / Docs / Chat | **LIVE** (Slice A done) | **BUILT** (+ Attachments/Media) | records/changelog/media/docs/chat + comments read | **DONE** on this branch — zero SoonTabs |
| Actions | **LIVE** (landing) | Built | n/a (static + feedback) | Low priority polish |
| Reports | **LIVE** (definitions list + detail/run; Phase 8) | **BUILT** + in nav | engine + proxies | **DONE** — EntityPanel stub (Phase 9); PDF/email env-gated; migrate **0038** first |
| Sources / Destinations | **LIVE** | Built | connections | Later visual sync; provider “coming soon” badges = **HONEST** (V2 platforms) |
| Settings | **LIVE** (hub — Phase 4) | Catalog hub **BUILT** | partial | Hub LIVE; remaining gated rows need prefs/2FA backends |
| Help | stub (“chat coming soon”) | Support portal separate app | — | `support` change; **BLOCKED** client Q#6 |
| Inbox (full page) | missing (dropdown may exist via layout work) | **BUILT** | notifications APIs exist | Promote `/inbox` after shell sync |
| Auth (login/welcome/2FA) | **LIVE** (page markup) | Redesigned views | better-auth | Promote views; keep auth logic |

\*Confirm Changelog tab mount on main Schema — Visualize/Changelog may be partial depending on branch history; treat as “don’t break live Schema.”

### Honest “coming soon” (leave alone unless product says otherwise)

- Extra source platforms (Notion, etc.) on Sources
- Unreleased destination providers / DB destinations
- Login SSO buttons when provider not configured
- Help in-app chat until Support exists

---

## 2. Ordered program (C)

| Phase | Name | What | Depends on |
|---|---|---|---|
| **0** | Guardrails | Commit plan artifacts on this branch; ledger tip `9cf5b1ef`; confirm Reports scope conflict; no promotion-branch merge | Approval of this doc |
| **1** | **Slice A — Data SoonTab un-gates (part 1)** | Promote ui-only Data UI for **Browse + Changelog + Attachments/Media** over existing engine routes; proxies + mappers + tests; Storybook/daisyUI only | Phase 0 · **DONE** · Plan: [`docs/superpowers/plans/2026-08-20-slice-a-data-soon-tabs.md`](../../../docs/superpowers/plans/2026-08-20-slice-a-data-soon-tabs.md) (Tasks 1–6) |
| **2** | **Slice A — Data SoonTab un-gates (part 2)** | **Comments** read path + Comments panel; then **Docs + Chat** | Phase 1 · **DONE** · same plan (Tasks 7–11) — zero SoonTabs on DataView |
| **3** | Design harness sync | `/ui-sync` Stage-1 into `apps/design`; reconcile reverse/diverged first | **REVISIT AFTER PROGRAM** (large tip drift; promote-per-surface used instead — do not drop) |
| **4** | Settings hub | Promote ui-only Settings catalog; wire real rows; honest-gate the rest | **DONE** · `2390c175` |
| **5** | Auth visual convergence | Promote Login/Welcome/Association; auth scroll contract; keep better-auth | **DONE** · `a11f2edd` |
| **6** | Inbox full page | Promote `InboxView` → `/inbox`; reuse notification proxies | **DONE** · `d94fa4cc` |
| **7** | Visual sync of LIVE surfaces | Restore → Sources → Destinations → Home → Backups; preserve polls & contracts | **DONE** · Restore `099360f3` · Sources `c962d74b` · Destinations `a72e57e4` · Home `a541120a` · Backups `598f11b5` |
| **8** | Reports | Overturn V1 trim — finish engine + `web-reports-page`; restore `/reports` nav to match ui-only | **DONE** · backend `fdfd1e90` (from `4d3ff862`) · UI `9c4f1c63` · migration **0038** not applied to remote DB |
| **9** | Schema Automations / Interfaces | Engine manual-CRUD + web tabs | **DONE** on this branch — engine `13b51873`/`33c7e667` + web proxies `6e4a2712` + UI tabs (this commit). Capture funnel (`server-automations-interfaces-docs`) still deferred. |
| **10** | Support portal | `apps/support` from ui-only | **SKIP FOR NOW** (Q#6 — support channel not decided; revisit later) |
| **11** | Billing / usage | Phase 1 portal rows now; usage/meters from pricing guide + honest gates (no fork Usage view) | **UNBLOCKED 2026-08-20** — build from PRD/`pricing-guide` / placeholders; do not wait on Q#4 |
| **12** | Design-audit convergence | 41-item ship order (`web-design-audit-convergence`) | **NEXT** — promotions 4–9 landed; holdup was sequencing only |
| **13** | Schema re-architecture | Full fork Schema component set (~24 components + EntityPanel) | **UNBLOCKED 2026-08-20** — prior deferral was risk/size, not a missing dependency |

### Slice A detail (first code after approval)

**Why A was adjusted:** On `main`, Data is not “four real + two SoonTabs.” It is **five SoonTabs**. Docs/Chat alone would sit on an empty Data shell. Backend for browse/changelog/media already exists on the server; web proxies/UI do not.

1. Promote Data components from ui-only (Storybook/daisyUI intake order)
2. Wire `data.astro` + `backup-engine` + IDOR proxies for records / changelog / media
3. Replace Browse / Changelog / Media SoonTabs
4. Add comments **read** route (missing on main) → Comments tab
5. Mount Docs/Chat via existing Schema implementations + `dataToSchema` adapter
6. Gates: `managed_pg` honest empty states; `audit:components` green; unit tests; no fixtures

OpenSpec children: expand/correct `web-data-page` + `web-data-docs-chat` (docs/chat proposal currently assumes browse already shipped — false on this branch).

---

## 3. Decisions (resolved 2026-08-20)

1. **Reports:** match ui-only (bring back into program; Phase 8).
2. **Schema Automations/Interfaces:** include (Phase 9; engine-first).
3. **Commit plans** on `autumn/cursor-ui-implementation-test` — yes.

---

## 4. Explicit non-goals

- Merging `web-ui-sync-promotion` into `main` or this branch  
- Building V2 “coming soon” providers  
- Schema full re-arch while live shell works  
- Custom components outside Storybook / daisyUI  
- `apps/prelaunch` / `apps/survey`
