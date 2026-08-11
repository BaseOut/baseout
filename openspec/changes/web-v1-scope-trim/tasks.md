# Tasks — V1 scope trim (Reports hidden, SQL deferred)

## To do
- [x] Drop the Reports item from `apps/web/app-config.json` `navigation.top`
- [x] Replace `apps/web/src/pages/reports.astro` with `Astro.redirect('/')` (no 404 for
      stale links; PlaceholderView import goes away)
- [x] Mirror in the design harness: `apps/design/src/pages/reports.astro` redirects too
      (nav comes from the shared `app-config.json`, so the sidebar updates automatically)
- [x] Sweep for internal references to `/reports` (flow-registry, handoff, breadcrumbs
      via `getAllRoutes`) — none found beyond the two pages (grep 2026-07-07)
- [ ] Verify: sidebar shows Home · Backups · Restore · Schema (Space group) with no
      Reports; `/reports` 302→`/`; `astro check` + build green (runs with the Slice-1
      verification battery)
- [ ] Confirm with Dan when the PRD v1.1 §10 / §3.5 revision lands; if the SQL REST API
      stays V1, file its implementation under the parked `sql` change — no SQL work
      starts before that

## Notes
- Doc-only on the SQL side: the deferral is recorded in this change's spec delta; no
  code exists to remove (`apps/sql` is a placeholder Worker).
