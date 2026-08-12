# ui-only Sync — Ledger & Mechanism

Owner: whoever runs a sync. **Update this file in the SAME change as every
sync or promotion** (the CLAUDE.md §3.7 discipline, same as `oauth-setup.md`
and `r2-setup.md`). The procedure lives in `.claude/skills/ui-sync/SKILL.md`
(invocable `/ui-sync`); this file holds the mutable state.

---

## 1. Remote & mechanism

- Remote: `ui-only` → `git@github.com:BaseOut/ui-only.git` (Dan's design
  fork; a full monorepo fork with **unrelated git history**).
- **NEVER merge.** The mechanism is `git fetch ui-only` + selective file
  copy at a pinned `ui-only/main` hash (`git show ui-only/main:<path>` /
  `git checkout ui-only/main -- <path>` + relocate). One sync = one commit
  whose subject cites `ui-only@<hash>` — `scripts/ui-sync-status.mjs` parses
  that convention to find the last-synced point.
- Status: `pnpm ui:sync-status` (pending commits, changed files by surface,
  dirty-target warnings).
- **Reverse & drift:** `pnpm ui:sync-drift` classifies every synced surface as
  `in-sync` / `forward-pending` (fork ahead) / `reverse-pending` (WE are ahead,
  `apps/design/**` only) / `diverged` (both). The `/sync-reconcile` skill drives
  the reverse path — it emits a human-applied patch UP to `ui-only` and never
  auto-pushes. `--path <prefix>` scopes the report to one surface. Content-level
  3-way (byte-compare modulo import rewrites) is a follow-up; v1 is file-level.
- **Ledger gate:** `pnpm ui:sync-check` fails when a `chore(design): sync
  ui-only@…` tip commit did not also update THIS file (§6 rule, enforced).
- **storybook.ts reconcile:** `pnpm storybook:reconcile` prints the fork-side and
  local-side diffs of the shared catalog for the §2 standing 3-way merge.

## 2. Path-mapping table

| ui-only path | lands at | treatment |
|---|---|---|
| `apps/design/**` | same path | verbatim (pages/fixtures get the `@web` rewrites below; `src/pages/prototypes/*.html.ts` get the research-depth rewrite) |
| `apps/web/src/views/**` | `apps/design/src/views/**` | verbatim copy (files use relative imports; no rewrites needed) |
| `apps/web/src/components/{schema,ui}/**` | `apps/design/src/components/{schema,ui}/**` | verbatim copy (relative imports carry over) |
| `apps/web/src/components/integrations/**` | `apps/design/src/components/integrations/**` | verbatim copy (added 2026-07-29 — same localization convention as schema/ui) |
| `apps/web/src/stores/**` | `apps/design/src/stores/**` | verbatim copy (added 2026-07-29) — the design harness compiles against the FORK's store types; reconcile into the real `apps/web/src/stores/*` at promotion (fork type model ≠ persisted model until then) |
| `apps/web/src/components/layout/**` + `apps/web/src/layouts/**` | **straight to `apps/web`** at promotion — NO design copy | the design harness renders the app shell via the `@web` alias (`apps/design/src/layouts/SidebarLayout.astro` wraps `@web/layouts/SidebarLayout.astro`), so shell changes only render once they land in apps/web |
| `apps/web/src/lib/**` (design-coupled helpers, e.g. `csv.ts`) | `apps/design/src/lib/**` | verbatim copy; `ui.ts` stays a shim |
| `apps/web/src/styles/**` | **promotion-time only** → `apps/web/src/styles/**` | design has no style copies — `design.css` @source-scans apps/web, so styles reach the harness once promoted |
| `apps/web/app-config.json` | **never-sync** | fork drift (upstream carries routes we don't have); promotion adds entries selectively |
| `overview/**` | `apps/design/overview/**` | verbatim |
| `research/**` (HTML/MD) | `apps/design/research/**` | verbatim; **`shots/*.png` skipped** — retrievable at the pinned hash. Prototype pages import these via `?raw`: rewrite `../../../../../research/` → `../../../research/` |
| `openspec/changes/<x>/` | `openspec/changes/web-<x>/` (or per §3.6) | imported, task state preserved, backend-blocked tasks annotated |

**Permitted `@web` rewrites (design pages/fixtures only):**
`@web/components/schema` → `../components/schema`, `@web/views/SchemaView.astro`
→ `../views/SchemaView.astro`. All other `@web/*` imports (layouts, `lib/config`)
stay — they intentionally resolve to the real apps/web via the alias in
`apps/design/astro.config.mjs`.

**Permitted rewrites on sync (the ONLY edits):** `@web/views` → relative,
`@web/components/schema` → local, `@web/lib/ui` → local shim. Everything
else stays byte-identical so the next sync diffs cleanly.

**Standing exception:** `apps/design/src/lib/storybook.ts` — both sides edit
it; every sync is a 3-way reconcile (keep local entries + take upstream
entries). Note the reconcile in the ledger row.

**Never-sync list:** `.claude/**` (fork hooks/settings, e.g.
`ds-guard.mjs`), root `package.json` + lockfile, CI config, fork-local asset
deletions (e.g. `apps/web/public/images/auth-bg.png` removal), binary
screenshots under `research/**/shots/`.

## 3. Sync ledger

| date | ui-only hash | baseout commit | scope |
|---|---|---|---|
| 2026-06-12 | `f0f9171` | `789727e` | initial fork integration: apps/design baseline + openspec imports |
| 2026-07-04 | `beb43a7` | `6d4c698` | decoupled round-2 handoff surfaces only (flow-registry, handoff, schema-nav, planning docs); schema web layer deferred |
| 2026-07-08 | `d97c777` | `53110f8` | round-2/3 schema web layer LOCALIZED into apps/design (21 schema components + SchemaView + Drawer); React enabled; storybook 3-way |
| 2026-07-10 | `3153dfd` | `e93f111` | schema export control + csv.ts, panels round-4 (EntityPanel anchor model, entityChip/locationCrumbs), drawer/changelog/facet polish, prototypes pages, research+overview docs, `web-notifications-inbox` spec import. storybook.ts merged as upstream-skeleton + 11 local-only entries (upstream ships a duplicate `tooltip` id — left verbatim). Deferred to the 4c promotion commit: `fixtures/inbox.ts` + the design `SidebarLayout.astro` wrapper (both type-import `@web/components/layout/inbox`, which exists only after the app-shell promotion) |
| 2026-07-29 | `9a8b448` | (this commit) | SCOPED sync — base-picker workspace-grouping surface only: `components/integrations/{BaseSelectionTable,BasePickerRow,basePickerSearch}` + `schema/{EntitySearch,typeaheadItems,airtableGlyph}` + `views/IntegrationsSetupWizard` localized from fork apps/web; design pages `integrations/{configure,authorizing}` + `login.astro`; `fixtures/{integrations,sources,destinations}` + `lib/wsResolve` + `stores/{connections,sources,destinations}` + `components/backups/BackupScheduleScope`; storybook.ts PARTIAL reconcile (took `pattern-base-picker` ONLY — ~1.6k lines of other upstream entries ride the next full sync); `login-methods` spec imported as `web-login-methods`. **DEFERRED (flagged):** comments-explorer (`9a8b448` first slice — churning), schema field↔view cross-refs (`27404bf`+), data-lab/Data page batch, handoff/prototype rounds, remaining ~190 fork commits. |

## 4. Promotion status matrix

| surface | synced at | promoted in | data wired | legacy rollback |
|---|---|---|---|---|
| Schema shell + 8 tabs | `d97c777` | `09949d3` (web-schema-round3-shell) | yes — SSR `schema.astro` via `createBackupEngine()` | pre-split SchemaView in git history |
| Schema Visualize / Changelog tabs | `d97c777` | in-flight on `autumn/june-ui-refactor` (web-schema-visualize / web-schema-changelog) | changelog feed live; visualize from SSR payload | — |
| Schema export control | `3153dfd` | `web-schema-export` (patterns/ExportControl + lib/csv, mounted on all 7 Schema tabs) | Browse + Changelog export REAL CSV client-side (`schema:export` event + `export-rows.ts`); other tabs honest-fallback until their backends | — |
| EntityPanel anchor model + panel polish | `3153dfd` (design harness) | **STAGED — web mount deliberately deferred** (2026-07-10): the type-import closure drags 3 fixture-driven tab components into web; draft/publish/generate actions are fixture-faked upstream, so mounting would replace the real docs-by-entity panel with faked actions; upstream drawer-round4 client questions still OPEN. 19 styleguide entries for un-promoted surfaces carry `design:`-prefixed references (the resolvability gate skips them; retarget at promotion). **2026-08-11 (design-descriptions-readonly): the Airtable description tab is now READ-ONLY in the harness — the faked Publish/Discard-to-Airtable flow, the `descStates` publish states, and the `airtableDraft`/`airtableExternallyChanged` seed on `Deals ▸ Stage` were removed; Internal stays editable. This DIVERGES `EntityPanel.astro` + that fixture + the storybook.ts `pattern-entity-panel` entry from `ui-only`. **`ui:sync-drift` then revealed the fork ALREADY did this, more completely, in `ui-only@7502f81` ("Airtable goes read-only, and writing gets its own section", Oleh 2026-08-07) — lifecycle deleted across panel + controller + Browse tree + both type sets. So the resolution is a FORWARD-sync of `7502f81` that SUPERSEDES this hand-edit — NOT a reverse-sync UP. Our edit is a buildable interim until that forward-sync lands.**} | pending — superseded by `7502f81` on the next schema forward-sync | current BrowseTab panel is the working fallback (already read-only) |
| Actions landing (read-only "writing gets its own section") | `7502f81` (design harness) | **`web-actions` (2026-08-11): promoted `ActionsView.astro` VERBATIM into `apps/web` (self-contained daisyUI, bespoke=0) + `lib/actions.ts` examples + `app-config.json` nav (`/actions`) + Features §1 `Action` dict** | landing only — static example copy; feedback form is a no-JS GET placeholder (POST+store is a follow-up) | `agents.astro` (the replaced hand-built draft) deleted |
| Notifications Inbox | `3153dfd` | `web-notifications-inbox` §1–4 (Inbox + inbox.ts + inbox-client verbatim; AppShellHeader bell removed/`lg:hidden`; AppShellSidebar trigger + badge; SidebarLayout `inboxItems` prop default `[]` → designed zero-states) | **LIVE end-to-end** (2026-07-10): engine feed `GET/POST /api/internal/spaces/:id/notifications{,/triage,/mute}` (derive-not-mailbox, per-Space `bo_at_inbox_state`/`bo_at_inbox_mutes`, SPACE_SCHEMA_VERSION 6) + web fan-out in SidebarLayout + optimistic triage via `/api/spaces/:id/inbox/*` proxies. Deferred: health-drop kind (needs debounce), per-user read state, web §5.2-5.4 | Header/Sidebar pre-inbox in git history |

## 5. Known traps

- **Must-refresh polling regression:** promotions that swap the view
  mounting the backup-status widget drop the 2s poll wiring
  (`apps/web/src/stores/backup-runs.ts` + widget lifecycle). Re-verify after
  every app-shell or Integrations-adjacent promotion.
- **Verbatim tsc errors:** upstream `.ts` files carry strict-mode errors —
  leave them; `pnpm --filter @baseout/design build` is the gate. Fixing them
  breaks diffability.
- **storybook.ts reconcile:** never overwrite blindly (see §2).
- **EntityPanel write-back — the fork already removed it (7502f81):**
  `design-descriptions-readonly` hand-removed the faked Airtable write-back from
  `apps/design/.../EntityPanel.astro` (a buildable interim). Then `ui:sync-drift`
  showed `ui-only@7502f81` ("Airtable goes read-only, and writing gets its own
  section", Oleh 2026-08-07) had ALREADY done it, more completely (panel +
  controller + Browse tree + both type sets). **Resolution = FORWARD-sync
  `7502f81` to SUPERSEDE the hand-edit — do NOT reverse-sync ours up.** Until
  then, a forward sync of `EntityPanel.astro` / the `Deals ▸ Stage` fixture / the
  storybook `pattern-entity-panel` entry is SAFE (it brings the canonical
  read-only version) — the earlier "must not re-import" concern is void now that
  the fork's version IS the read-only one. `web-actions` already promoted the
  paired Actions landing from the same commit.
- **Header/Inbox entanglement:** the Inbox surface edits
  Header/Sidebar/SidebarLayout — an app-shell change. Never land it
  half-promoted (design and web must agree on which shell renders).
- **astro/@astrojs/node version pairing:** older pairs break; the 7-day
  `minimumReleaseAge` gate picks versions (see `53110f8`).
- **Dirty targets:** never sync onto uncommitted local edits of the same
  file — `pnpm ui:sync-status` flags these; commit first.

## 6. Update rules

- New sync → add a §3 row (replace the *pending* row) + update §4 rows it
  affects, same commit.
- New promotion → update the §4 row (promoted in / data wired / legacy),
  same commit.
- New trap discovered → add to §5 in the change that hit it.
- Cite `ui-sync.md §N` in openspec proposals and commit bodies when a
  decision leans on this file.
