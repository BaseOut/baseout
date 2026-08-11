# admin-operations-overview — Tasks

## 1. Pure dashboard module (TDD)

- [x] 1.1 `dashboard.test.ts` (4): `formatElapsed` (m/h/d, clamps negatives), `assembleActiveRuns` (backup+restore merged, oldest-first, elapsed from `started_at ?? created_at`), `successRate` (terminal-only denominator, null on zero), `attentionGroups` (non-empty only, deep-dive hrefs).
- [x] 1.2 `src/lib/dashboard.ts` (green); reuses `RUN_STATUS_BADGE` from `backup-runs.ts` (no window-logic duplication).

## 2. Dashboard page

- [x] 2.1 Admin mirror already had the needed columns after C.4 (`backup_configurations.schema_next_scheduled_at` present; `restore_runs` status/timestamps present). No new mirror needed.
- [x] 2.2 Rewrote `src/pages/index.astro` as the dashboard: bounded queries (active backup+restore runs, 7-day KPI window, overdue schedules, unhealthy connections, DB errors, recent failures — each with a true `count()` total), sections Active runs / KPI tiles / Attention items, @web PageHeader/Card/Badge/EmptyState, every Space/Org/run via EntityLink, per-section empty states.
- [x] 2.3 Attention deep-dive links go through `dashboard.ts` `DEEP_DIVE` constants → the real `/errors` (+ `/services`) surfaces (admin-error-triage landed, so no fallback needed).

## 3. Tracker relocation + nav

- [x] 3.1 `admin-entity-directories` landed → `/customers` exists (the org/customer directory). The old `/` tracker is superseded by the dashboard + `/customers`; force-backup remains on `/errors` + the `/api/actions/force-backup` route (documented in the page header). No verbatim move needed.
- [x] 3.2 Replaced the flat nav with grouped `NAV_GROUPS` (Operations / Directory / Billing / System) in `src/lib/nav.ts`; `SidebarLayout.astro` renders group headers (hidden on the collapsed rail); `isActive` unchanged; `/` relabelled Overview.
- [x] 3.3 `nav.test.ts` (2): every href resolves to an existing page file (no dead links) + unique hrefs.

## 4. Verification

- [x] 4.1 `pnpm --filter @baseout/admin` astro-check 0 errors + full Vitest 248 (dashboard 4, nav 2 new).
- [ ] 4.2 **DEFERRED (human smoke, local):** `/` shows the dashboard with a seeded running + failed run; links land on `/backups/[id]`, org/space detail, `/errors`; sidebar groups render expanded + collapsed.
- [ ] 4.3 **DEFERRED (deploy):** redeploy `baseout-admin-dev`; confirm against real data + `/customers` serves the directory.
