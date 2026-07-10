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

## 2. Path-mapping table

| ui-only path | lands at | treatment |
|---|---|---|
| `apps/design/**` | same path | verbatim |
| `apps/web/src/views/**` | `apps/design/src/views/**` | verbatim copy, localized imports |
| `apps/web/src/components/{schema,ui,layout}/**` | `apps/design/src/components/{schema,ui,layout}/**` | verbatim copy, localized imports |
| `apps/web/src/lib/**` (design-coupled helpers) | `apps/design/src/lib/**` | verbatim copy; `ui.ts` stays a shim re-exporting from `@web` behavior |
| `apps/web/src/styles/**` | `apps/design/src/styles/**` (then `apps/web/src/styles/global.css` at promotion) | verbatim on sync; prefixed sections on promotion |
| `overview/**` | `apps/design/overview/**` | verbatim |
| `research/**` (HTML/MD) | `apps/design/research/**` | verbatim; **`shots/*.png` skipped** — retrievable at the pinned hash |
| `openspec/changes/<x>/` | `openspec/changes/web-<x>/` (or per §3.6) | imported, task state preserved, backend-blocked tasks annotated |

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
| — | `3153dfd` | *pending* | schema export control, panels round-4 (EntityPanel anchor model), Notifications Inbox, drawer/changelog/facet polish, research+overview docs |

## 4. Promotion status matrix

| surface | synced at | promoted in | data wired | legacy rollback |
|---|---|---|---|---|
| Schema shell + 8 tabs | `d97c777` | `09949d3` (web-schema-round3-shell) | yes — SSR `schema.astro` via `createBackupEngine()` | pre-split SchemaView in git history |
| Schema Visualize / Changelog tabs | `d97c777` | in-flight on `autumn/june-ui-refactor` (web-schema-visualize / web-schema-changelog) | changelog feed live; visualize from SSR payload | — |
| Schema export control | `3153dfd` pending | planned: `web-schema-export` | SSR schema payload + `lib/csv.ts` | — |
| EntityPanel anchor model + panel polish | `3153dfd` pending | planned: `web-schema-panels-round4` (upstream drawer-round4 questions OPEN — promoted per user direction 2026-07-10) | entity-graph/back-refs payload (`entity-index.ts`) | prior EntityPanel → `.legacy` |
| Notifications Inbox | `3153dfd` pending | planned: `web-notifications-inbox` (UI mounted, feed empty/"soon") | blocked on paired `server-notifications-inbox` | Header/Sidebar pre-inbox in git history |

## 5. Known traps

- **Must-refresh polling regression:** promotions that swap the view
  mounting the backup-status widget drop the 2s poll wiring
  (`apps/web/src/stores/backup-runs.ts` + widget lifecycle). Re-verify after
  every app-shell or Integrations-adjacent promotion.
- **Verbatim tsc errors:** upstream `.ts` files carry strict-mode errors —
  leave them; `pnpm --filter @baseout/design build` is the gate. Fixing them
  breaks diffability.
- **storybook.ts reconcile:** never overwrite blindly (see §2).
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
