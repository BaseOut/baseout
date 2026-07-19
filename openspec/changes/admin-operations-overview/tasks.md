# admin-operations-overview — Tasks

## 1. Pure dashboard module (TDD)

- [ ] 1.1 Write Vitest specs for `apps/admin/src/lib/dashboard.ts`: `formatElapsed(from, now)`; active-run assembly (backup + restore rows merged, oldest-first, elapsed from `started_at ?? created_at`); success-rate derivation (terminal-only denominator, em-dash on zero); attention-group assembly (overdue schedules incl. `schema_next_scheduled_at`, unhealthy connections, DB errors, recent-failures excerpt truncation); deep-dive href constants (fallback targets while `/errors` is absent)
- [ ] 1.2 Implement `dashboard.ts` to green, importing `summarizeRuns`/`RUN_STATUS_BADGE` from `./backup-runs` (no window-logic duplication)

## 2. Dashboard page

- [ ] 2.1 Extend the admin schema mirror only if a needed column is missing (candidates: `backup_configurations.schema_next_scheduled_at`, `restore_runs` status/timestamps) — header comments name `apps/web/src/db/schema/core.ts` as canonical; never mirror `*_enc` columns
- [ ] 2.2 Rewrite `src/pages/index.astro` as the dashboard: the 7 bounded queries from design decision 2 (with true totals for truncated attention lists), sections Active runs / KPI tiles / Attention items, `@web` PageHeader/Card/Badge/EmptyState, every Space/Org/run rendered as a link, explicit empty states per section
- [ ] 2.3 Wire attention-group deep-dive links through the `dashboard.ts` href constants (no literal `/errors` anywhere else)

## 3. Tracker relocation + nav

- [ ] 3.1 If `admin-entity-directories` has not landed: move the tracker markup from `index.astro` to `src/pages/customers.astro` verbatim (same `tracker.ts`, same `?q=`); if it has landed: confirm `/customers` exists and skip
- [ ] 3.2 Replace `navItems` with grouped `navGroups` in `SidebarLayout.astro` (Operations / Directory / Billing / System per spec), listing only routes that exist in this build; keep `isActive` rule; verify collapsed-rail rendering with group headers
- [ ] 3.3 Vitest for nav-group data shape: every href maps to an existing page file (guard against dead links)

## 4. Verification

- [ ] 4.1 `pnpm --filter @baseout/admin test` green; `npm run typecheck` + build green
- [ ] 4.2 Human smoke (local dev): `/` shows dashboard with a seeded running run + failed run; links land on `/backups/[id]`, org detail, `/customers`; sidebar groups render expanded + collapsed
- [ ] 4.3 Human smoke (deployed dev worker): redeploy `baseout-admin-dev`, confirm dashboard renders against real data and `/customers` serves the tracker
