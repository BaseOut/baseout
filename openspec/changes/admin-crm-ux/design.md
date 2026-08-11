# admin-crm-ux — design

## Context

Every admin listing today follows the `admin-entity-directories` pattern: the `.astro` page runs a handful of bounded SQL queries (hard `LIMIT 100–200`), passes flat arrays to a pure lib module that joins/derives/sorts **in memory**, and renders a full table. Filters are ad-hoc query params handled per page; there is no pagination, no column sorting, and no shared table chrome. Mutation buttons live inline on listing rows (`/connections` invalidate, `/migration` force-complete, `/errors` acknowledge, dashboard force-backup). The omnisearch box sits in the sidebar and submits to `/search`.

The in-memory-assembly house style is the central constraint: it is what makes the libs testable without a DB, but it breaks once pagination is server-side — you cannot sort or filter on a derived column (MRR, derived subscription status, connection health class) in memory when SQL has already truncated the page.

Constraints carried forward unchanged: master-DB-only via Hyperdrive, no `*_enc` columns ever, admin owns no migrations, all routes behind the staff-gate middleware, daisyUI + no-JS-first pages, actions keep their audit + confirm machinery.

## Goals / Non-Goals

**Goals:**

- One table convention (URL params → validated query plan → `{ rows, total }` → shared chrome) reused by every listing page.
- True server-side pagination and sorting that a support person can trust at 10k+ orgs/runs.
- `/organizations` as the CRM entry point with status/platform/subscription filters; `/organizations/[id]` as the per-account command center.
- Read-only listings; every action reachable from a detail page; closed navigation loops (listing ↔ detail ↔ owning org).
- Top-bar global search with typeahead, degrading to the existing `/search` page.

**Non-Goals:**

- No new actions, no action-semantics changes, no audit changes.
- No search infrastructure (pg_trgm, materialized views, external index).
- No per-Space DB access (`admin-data-boundary` unchanged).
- No infinite scroll / client-side table framework; no React island for tables.
- No keyset pagination (see Decisions — offset is fine at admin scale).

## Decisions

### D1 — URL query string is the single source of table state

`?page=` (1-based), `?per=` (25/50/100, default 50), `?sort=<column-key>`, `?dir=asc|desc`, `?q=`, plus per-page filter params (`?status=`, `?platform=`, `?tier=`…). No cookies, no client state. Sorting/filter/pagination links are plain `<a>` hrefs rendered server-side, so everything works without JS and every view is shareable/bookmarkable. Changing sort or filter resets `page` to 1 (stale offsets otherwise show confusing empty pages).

*Alternative considered:* POST + session state (Stripe-style sticky filters) — rejected: breaks shareability and the no-JS rule, and adds session write traffic for no support-workflow win.

### D2 — `table-query.ts`: a pure planner, SQL keeps execution

New pure lib `src/lib/table-query.ts` owns parsing + validation + planning; it never touches the DB (house style preserved — fully unit-testable):

- `parseTableQuery(url, spec)` → `{ page, per, offset, sort, dir, q, filters }`. `spec` declares the **whitelist**: allowed sort keys, allowed filter keys + allowed values, default sort. Unknown/invalid values fall back to defaults — never an error page, never a passthrough.
- Each listing page defines a `TableSpec` mapping sort keys to Drizzle column references (`sortMap: { name: organizations.name, created: organizations.createdAt, … }`). The page builds its query as `…WHERE <filters> ORDER BY <sortMap[sort]> LIMIT per OFFSET offset` plus a `COUNT(*)` sharing the identical WHERE. Dynamic SQL identifiers never come from user input — only whitelisted Drizzle column objects.
- `pageInfo(total, page, per)` → `{ totalPages, from, to, hasPrev, hasNext, clampedPage }` for the pager component.

*Alternative considered:* a generic `runTable()` helper that also executes the query — rejected: it would need the DB client + dynamic query building in one shared function, hiding SQL from the page and fighting Drizzle's typing. Pages staying thin query shells is the existing, working pattern.

### D3 — Sortable/filterable columns move into SQL; in-memory assembly keeps display-only derivation

The rule that resolves the house-style tension: **any column offered for sort or filter must be computable in the SQL of the page query; in-memory lib assembly is only for display-only enrichment.**

- Cheap aggregates join in via subqueries/lateral joins (space count, member count, last-run timestamp) so they are sortable.
- The org **status/platform/subscription filters** become SQL predicates: `EXISTS (SELECT 1 FROM subscriptions s WHERE s.organization_id = o.id AND s.status = $status [AND s.platform_id = $platform] [AND s.tier = $tier])`, with `status=none` as `NOT EXISTS(… status IN ('active','trialing','past_due'))`.
- Derived values that are expensive or algorithmic (MRR estimate, connection health class) stay in-memory and are **not sortable/filterable in this change**; the column header simply renders unsortable. Exception: `/connections` keeps a coarse SQL `?status=` filter on the raw column while the six-way health class remains display-only.

*Alternative considered:* fetch-all-then-paginate-in-memory — rejected: that is the current bounded behavior with extra steps; it re-truncates at scale. *Also considered:* pushing MRR into SQL — rejected for this change; interval math × tier pricing in SQL duplicates `estimateMrr` logic for a sort nobody asked for.

### D4 — Offset pagination, count on every page load

`LIMIT/OFFSET` + `COUNT(*)`. Admin tables top out in the tens of thousands of rows for years; Postgres handles that offset depth trivially, and staff genuinely use "page 1 of 37" + jump-to-last. Counts share the WHERE clause, so cost tracks the filter. If a count ever gets hot, `EXPLAIN`-estimate fallback is a follow-up, not a design constraint now.

*Alternative considered:* keyset/cursor pagination — rejected: no stable unique sort key across all listings without composite cursors, loses page numbers, and solves a scale problem admin does not have.

### D5 — Shared table chrome: three Astro components, no framework island

`src/components/table/SortHeader.astro` (renders `<th><a>` with next-direction href + active indicator), `src/components/table/Pager.astro` (prev/next + numbered window + "n–m of total", `per` selector as links), `src/components/table/FilterBar.astro` (GET form: search input + labeled `<select>`s that submit on change via a 3-line progressive-enhancement script, plus a visible Apply button for no-JS). All are daisyUI, all take the parsed table query + spec so hrefs preserve every other param.

*Alternative considered:* one monolithic `DataTable.astro` that also renders rows via slots/render-props — rejected: Astro slot ergonomics make per-page cell markup awkward, and the pages differ too much (badges, links, health dots) for a generic renderer to pay off.

### D6 — `/customers` → `/organizations`, redirect kept

The directory page moves to `/organizations` (matching the canonical *Organization* term and the existing `/organizations/[id]` detail route); `/customers` becomes a 301 to `/organizations` preserving the query string. Sidebar nav label stays "Customers" → renamed "Organizations" under the Directory group. This supersedes the `/customers` placement owned by `admin-entity-directories`/`admin-nav-ia` in place.

### D7 — Command center = sectioned single page, not tabs

`/organizations/[id]` renders a header block (name, slug, status + tier badges, MRR, overage posture, migration flags, created) and then anchor-linked sections: Subscriptions, Spaces, Members, Connections, Backup runs, Restore runs, Databases, Storage destinations, Recent errors, Audit entries. A sticky in-page section nav (anchor links) gives the "command center" feel without tab state. Each section is bounded to its latest N with a "view all →" link into the corresponding global listing **pre-filtered to the org** (`/backups?org=<id>` — every listing gains an `org` filter key as part of D2 specs, which is also what makes the section pages cheap). Existing `org-detail.ts` assembly is extended, not replaced.

*Alternative considered:* real tabs (per-tab query params or subroutes) — rejected for now: sections keep the one-glance command-center property the user asked for; tabs can layer on later without spec change since data loading is per-section anyway.

### D8 — Back-navigation preserves list state via `ret` param

Listing rows link to detail pages with `?ret=<urlencoded current path+query>`. Detail pages render their "← Back to …" link from a **validated** `ret` (must parse as a same-app relative path starting with `/` and not `//` — otherwise fall back to the entity's default listing). No `document.referrer` sniffing, no history API dependency; works no-JS.

*Alternative considered:* `history.back()` JS link — rejected: breaks when the detail page was opened in a new tab or reached from search.

### D9 — Action placement: detail pages only; two new drill-ins give orphaned actions a home

- `/connections/[id]` (new): connection identity, org + spaces served (linked), health classification, status-audit history (`connection_status_audit`), sessions summary — and the **Invalidate connection** action.
- `/errors/[id]` (new): the error/failed-run detail with full error text, linked run/space/org — and **Acknowledge/Unacknowledge**.
- **Force backup** renders on `/spaces/[id]` (per-space) and the org command center; **Force migration** on the org command center (it is an org-level flag); invalidate/acknowledge as above.
- Listing pages and the dashboard render zero mutation controls. API routes, rate limits, audit writes, `action-confirm.ts` flow: unchanged.

### D10 — Top-bar search: same `/search` backend, thin typeahead endpoint

`SidebarLayout.astro` gains a fixed top bar (visible on every page) containing the search input; the sidebar box is removed. Baseline behavior is the existing GET → `/search` (query-shape detection + exact-match redirect reused untouched). Progressive enhancement: a small vanilla script (`Cmd/Ctrl+K` or `/` focuses the input) debounce-fetches `GET /api/search/suggest?q=` — a new staff-gated endpoint returning the top ~3 matches per entity type (id, label, context line, href) from the same `search.ts` lookup logic with tighter limits — rendered as a grouped dropdown; Enter with no selection submits the form as before.

*Alternative considered:* full command-palette modal (Stripe's actual pattern) — rejected for this change: strictly more JS for the same navigation outcome; the top-bar input + dropdown delivers "type anything, jump anywhere" and keeps the no-JS path identical.

## Risks / Trade-offs

- **[COUNT(*) on every listing load]** → acceptable at admin scale; WHERE-sharing keeps it proportional to the filter; revisit with estimates only if slow-query logs say so.
- **[Offset drift while paging]** (rows inserted between page loads shift offsets) → tolerated; listings default to newest-first where duplicates/skips are least confusing for support work.
- **[SQL-side aggregates re-implement small parts of lib derivation]** (e.g. last-activity join vs. `latestRuns` map) → contained by D3's rule; the pure libs keep owning labels/health/MRR, and their Vitest suites keep passing unchanged where display-only.
- **[`ret` param is an open-redirect shape]** → mitigated by strict same-app relative-path validation with listing fallback (D8).
- **[Two changes touching the same pages]** (near-done siblings `admin-error-triage` etc. still have open tasks) → supersession is documented in the proposal; implementation lands after those close or rebases trivially — all touches are additive page rewrites.
- **[Suggest endpoint adds a new read surface]** → staff-gated by existing middleware, reuses `search.ts` planning, returns metadata only (same fields the results page already shows); explicitly inside the `admin-data-boundary` line.

## Migration Plan

Pure code deploy of `apps/admin` (no data migration). Order inside the change: table-query lib + components → convert listings one page per task (each page independently shippable; unconverted pages keep bounded behavior) → org directory move + redirect → command center → new drill-ins + action relocation (remove listing buttons only in the same task that adds the detail-page button, so no action is ever homeless) → top bar + suggest endpoint. Rollback = redeploy previous Worker version; no state to unwind.

## Open Questions

- Filter vocabulary for `?status=`: exact Stripe subscription statuses (`trialing/active/past_due/canceled/…`) vs. the derived rollup used on `/customers` today (`active/trialing/…/none`). Design assumes the derived rollup vocabulary implemented as SQL predicates (D3); confirm during implementation that all rollup states are SQL-expressible (they are for the known set).
- Whether `/errors/[id]` keys on `backup_runs.id` (failed runs are the current error source) or a composite — resolved at implementation by whatever `admin-error-triage` landed as its row identity; the spec requires only "a stable per-error detail URL".
