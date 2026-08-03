# admin-crm-ux — tasks

TDD throughout (CLAUDE.md §3.4): each pure-lib task writes its Vitest suite first. Ordering follows design.md's migration plan — listings convert one page per task and stay independently shippable; listing action buttons are removed only in the same task that adds the detail-page home (spec: no homeless actions).

## 1. Table infrastructure

- [ ] 1.1 `src/lib/table-query.ts` + tests: `TableSpec` type (sort whitelist → Drizzle column refs, filter keys + allowed values, defaults), `parseTableQuery(url, spec)` with fallback-never-error validation, `pageInfo()` clamping, and an href builder that preserves sibling params and resets `page` on sort/filter change
- [ ] 1.2 Shared chrome components `src/components/table/SortHeader.astro`, `Pager.astro`, `FilterBar.astro` (daisyUI, no-JS links/GET forms, active-sort indicator, "n–m of total", submit-on-change progressive enhancement with visible Apply fallback)
- [ ] 1.3 Convert `/backups` (largest table, proves the pattern): page + count query sharing WHERE, `?status=`/`?org=`/`?q=` filters in SQL, sortable columns, remove the bounded cap; lib returns display-only enrichment for the current page
- [ ] 1.4 Convert `/spaces`, `/users`, `/subscriptions` to the shared planner + chrome (each with its `TableSpec`, `org=` filter where applicable, SQL-side search/filters)
- [ ] 1.5 Convert `/connections`, `/databases`, `/restores`, `/errors`, `/audit` likewise; health-class and MRR columns render non-sortable per design D3

## 2. Organizations directory + command center

- [ ] 2.1 Move directory to `/organizations` with 301 from `/customers` (query string preserved); update sidebar nav label/group and all internal links
- [ ] 2.2 Directory filters + tests: SQL predicates for status rollup (incl. `none` as NOT EXISTS), platform, and tier; combinable with `q` (name/slug/member email), sort, pagination; sortable SQL aggregates (space count, member count, last activity) via lateral joins
- [ ] 2.3 Command-center rebuild of `/organizations/[id]`: header (identity, status/tier badges, MRR, overage, migration flags) + sections (Subscriptions, Spaces, Members, Connections, Backup runs, Restore runs, Databases, Storage destinations, Recent errors, Audit) with in-page anchor nav; extend `org-detail.ts` + tests
- [ ] 2.4 Per-section "view all →" links to org-filtered listings (`?org=<id>`), bounded most-recent-N per section
- [ ] 2.5 `ret` back-navigation + tests: href builder attaches `ret` on listing rows; shared `validateReturnPath()` (same-app relative path, `//`/scheme rejected, listing fallback); back links on detail pages and the command center

## 3. Detail drill-ins + action relocation

- [ ] 3.1 `/connections/[id]` + `src/lib/connection-detail.ts` + tests: identity/platform, health classification, owning org link, spaces served, `connection_status_audit` history, session summary — metadata only, no `*_enc`
- [ ] 3.2 Relocate invalidate-connection onto `/connections/[id]` and remove it from the `/connections` listing (same task; endpoint/confirm/audit untouched)
- [ ] 3.3 `/errors/[id]` + lib + tests: stable per-error URL (row identity per what `admin-error-triage` landed), full error text/context, run/space/org links, ack state + history; relocate acknowledge/unacknowledge here and strip it from `/errors`
- [ ] 3.4 Add force-backup to `/spaces/[id]` and the command center; add force-migration to the command center; remove all mutation controls from `/`, `/migration`, and any remaining listing (verify zero POST-to-action forms on listing pages)
- [ ] 3.5 Owning-org backlink audit: every entity detail page (space, user, connection, backup run, restore run, error) links to the command center

## 4. Global search top bar

- [ ] 4.1 Top bar in `SidebarLayout.astro` on all pages with the search input (GET → `/search` unchanged); remove the sidebar search box; Cmd/Ctrl+K and `/` focus shortcut
- [ ] 4.2 `GET /api/search/suggest` + tests: staff-gated, reuses `search.ts` lookup planning with tight per-type limits, returns `{ id, label, context, href }` per entity group only
- [ ] 4.3 Typeahead dropdown: debounced fetch, grouped rendering, arrow/Enter/Escape keyboard handling, Enter-with-no-selection submits the form; no-JS path verified identical

## 5. Verification & docs

- [ ] 5.1 Cross-page sweep: every listing uses the shared planner/chrome, all sort/filter params whitelist-validated, counts match filters (spot-check with seeded data at >2 pages)
- [ ] 5.2 `pnpm --filter @baseout/admin test`, typecheck, build green; mobile pass at <768px on `/organizations` and the command center
- [ ] 5.3 Update sibling-change supersession notes (bounded-limit wording in `admin-entity-directories`/`admin-read-surfaces`, sidebar-search placement in `admin-support-search`, `/customers` ownership in `admin-nav-ia`) per proposal
