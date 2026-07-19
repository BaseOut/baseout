# admin-operations-overview — Design

## Context

`apps/admin` today: `/` runs the Organizations → Spaces tracker (`src/lib/tracker.ts` + `src/pages/index.astro`); `/backups` already computes 24h/7d window summaries in a pure module (`src/lib/backup-runs.ts` — `summarizeRuns(runs, now)`); `/services` derives scheduler signals (`src/lib/service-health.ts` — overdue schedules, last scheduled run, cleanup heartbeat, stale sessions); `/connections` classifies connection health. The dashboard is largely a *composition* of query shapes that already exist page-locally, plus a nav restructure in `SidebarLayout.astro` (flat `navItems` array, `isActive` prefix rule).

Sibling changes being authored concurrently: `admin-entity-directories` (owns `/customers`, `/users`, `/spaces`), `admin-error-triage` (owns `/errors`), `admin-support-search`, `shared-service-runs`. This change must not collide with their files.

## Goals / Non-Goals

**Goals:**

- One glance answers: what is running, what failed recently, what needs attention.
- `/` loads fast (bounded queries, one round-trip set) and every entity mention is a link.
- Grouped nav that scales as sibling pages land, without dead links.

**Non-Goals:**

- No mutations (force-backup etc. stay on their existing surfaces).
- No per-Space DB reads, no `*_enc` columns, no locator dereferencing.
- No error acknowledgement/triage workflow (that is `admin-error-triage`).
- No `service_runs`-backed truth (that is `shared-service-runs`); dashboard reuses today's derived signals.
- No live auto-refresh/WebSocket — SSR snapshot per load (a `meta refresh` is optional polish, not required).

## Decisions

1. **Pure module `src/lib/dashboard.ts`, page does queries.** Follow the established admin pattern: the `.astro` page runs bounded Drizzle queries and passes rows to pure functions taking `now: Date` (assembly of active runs with elapsed time, KPI windows, attention groups). Vitest targets the pure module only. *Alternative — reuse `summarizeRuns` from `backup-runs.ts` directly:* do reuse it (import, don't duplicate); `dashboard.ts` adds only what's new (elapsed-time formatting, success rate, attention assembly).

2. **Query budget: 7 bounded queries, no N+1.**
   - Active backup runs: `backup_runs where status in ('queued','running','cancelling')` joined to spaces + organizations, `limit 50`.
   - Active restore runs: same shape on `restore_runs`, `limit 20`.
   - KPI window rows: `backup_runs where created_at >= now-7d` selecting only status/created_at (+ restore count via one aggregate) — reuses the existing `/backups` window logic.
   - Overdue schedules: `backup_configurations join spaces (status='active') join organizations where next_scheduled_at < now or schema_next_scheduled_at < now`, `limit 25`.
   - Unhealthy connections: `connections where status != 'active'` joined to organizations, `limit 25`.
   - DB provisioning errors: `space_databases where status = 'error'` joined to spaces/organizations, `limit 25`.
   - Recent failures: `backup_runs where status='failed' order by created_at desc limit 10` joined to spaces/organizations.
   Counts per attention group come from `count(*)` on the same predicates (cheap; same statement via a window count or a second aggregate query — implementer's choice, but the rendered count must be the true total, not the truncated list length).

3. **Elapsed time from `started_at ?? created_at`.** Queued runs have no `started_at`; showing "queued 14m" from `created_at` is the operationally useful number. Format with a small `formatElapsed(from, now)` in `dashboard.ts` (mirrors `formatDuration`'s style in `backup-runs.ts`).

4. **`/errors` link indirection via a single constant.** `dashboard.ts` exports per-group deep-dive hrefs; until `/errors` ships, they point at `/backups?status=failed`, `/connections`, `/databases`, `/services`. When `admin-error-triage` lands it flips these to `/errors#<group>` in one place. Rationale: the spec forbids dead links; a route-existence check at runtime is overkill inside one app.

5. **Nav: `navGroups` replaces `navItems` in `SidebarLayout.astro`.** `Array<{ label: string; items: NavItem[] }>` rendered as daisyUI `menu-title` headers + existing item markup; `isActive` unchanged. Only routes that exist in this build are listed — sibling changes append their own entries when they land (each change owns its one-line nav addition; grouping structure is owned here). Collapsed state: group headers hide (icon-only rail), which the existing hover-expand pattern already handles.

6. **Tracker relocation is a `git mv`-style move, not a rewrite.** If `admin-entity-directories` has not landed when this is implemented: move `index.astro`'s tracker markup to `customers.astro` verbatim (same `tracker.ts` lib, same `?q=`), then rewrite `index.astro` as the dashboard. If it has landed: skip the move, just rewrite `index.astro`. No redirect from old bookmarks needed beyond this (`/` still works — it shows the dashboard, which links to `/customers`).

7. **Components: reuse `@web` UI (PageHeader, Card, Badge, EmptyState) + existing badge maps.** `RUN_STATUS_BADGE` from `backup-runs.ts` is reused for run rows; attention severities map to `warning`/`error` badge variants. No new Storybook components — daisyUI stat tiles as already used on `/backups`.

## Risks / Trade-offs

- [Dashboard snapshot goes stale while staring at it] → acceptable for v1; statuses change on reload. Optional `<meta http-equiv="refresh" content="60">` if wanted; no client JS.
- [Sequencing with `admin-entity-directories` on `/customers`] → decision 6 makes either order safe; the only conflict surface is `customers.astro`, and the directory version wins. Coordinate at implementation time; whichever lands second reconciles.
- [`connections.status != 'active'` may over-report (e.g. transient `refreshing`)] → include status in the row so staff can eyeball; `refreshing` older than 15 minutes is the stuck case per `/connections` classifier — reuse that classifier's stuck-threshold logic rather than re-deriving.
- [Two sources of 24h/7d truth if `dashboard.ts` re-implements windows] → mitigated by importing `summarizeRuns` (decision 1); a drift is a test failure in one place.
- [Nav groups grow stale as sibling pages land] → each sibling change adds its own entry into the group structure defined here; grouping is data (`navGroups`), so additions are one-line.

## Migration Plan

Single deploy of `apps/admin` (dev worker) — no DB changes, no cross-app changes. Rollback = redeploy previous build. Bookmark impact: `/` changes meaning; the tracker remains one click away at `/customers`.

## Open Questions

- None blocking. Exact KPI tile set beyond the specified minimum (e.g. attachment counts) is implementer's discretion within the "top-level status only" boundary.
