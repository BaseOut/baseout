## Status

Not started. Web half of Reports over [`shared-backup-reports`](../shared-backup-reports/)
(filed per its task 5.2). Blocked on the engine's report assembly/scheduling/render/
delivery routes landing.

---

## 1. Web client + proxy routes (tests first)

- [ ] 1.1 `backup-engine.ts` — report client methods + view types: `listReports`, `getReport` (versioned JSON document with typed entity refs), `generateReportNow`, `listReportSchedules` / `createReportSchedule` / `updateReportSchedule` / `deleteReportSchedule`, `getReportArtifact`.
- [ ] 1.2 Proxy routes under `pages/api/spaces/[spaceId]/reports/` — middleware-guarded + capability-gated: `index.ts` (GET list), `[reportId].ts` (GET document), `generate.ts` (POST), `schedules.ts` (GET/POST) + `schedules/[scheduleId].ts` (PATCH/DELETE — recipient email validation + recipient cap server-side), `[reportId]/artifact.ts` (GET — authorize session + Space membership, resolve via engine, stream the artifact; PDF/HTML content types). Route tests per file (403 below tier, 400 invalid recipients, artifact requires membership, engine passthrough shape).
- [ ] 1.3 Tier mapping reconciled with Features §5.5 in `tier-capabilities.ts` (+ test): manual run + in-app view vs scheduled email delivery as separate checks. Flag a spec conflict rather than inventing if the matrix has no entry.

## 2. Reports UI (port via /ui-sync)

- [ ] 2.1 Port `ReportsView.astro` per ui-sync §4.2 intake order, retiring the `PlaceholderView` for `/reports`: report list (period, generated-at, manual/scheduled trigger, delivery status via StatusBadge), **Run report now** (`setButtonLoading`, row appears generating → complete), empty/first-run state pointing at Backups.
- [ ] 2.2 Report detail view rendering the JSON document: four sections (backup summary · connection health · schema health · docs updates), `{status: "clean"}` sections render "no issues" (never omitted), failed generations surfaced on the list with error text.
- [ ] 2.3 Clickable typed refs: schema entities → shared entity detail sidebar; backup runs → run detail; docs → doc view; external destination copies → destination location link-out.
- [ ] 2.4 Schedules UI: cadence (after every backup / daily / weekly / monthly), recipients (cap surfaced), format (PDF attachment and/or HTML link), enable/pause, per-recipient delivery status on past runs, manual re-send for failed deliveries.
- [ ] 2.5 Exports: PDF + HTML download of any report through the authorized artifact route. Below-tier: standard upgrade affordance (view vs scheduled-delivery gates render distinctly). Update `shared/internal/ui-sync.md` ledger in the same change as the promotion.

## 3. Verification

- [ ] 3.1 `pnpm --filter @baseout/web typecheck` + `build` green; new route tests green; `audit:components` clean; no stray `console.*`; mobile pass at <375/<768/<1024.
- [ ] 3.2 Human smoke: Space with backup history → `/reports` → Run report now → report lists and opens with all four sections → click a schema ref (sidebar) and a run ref (run detail) → download PDF + HTML → create a schedule with a recipient → scheduled run delivers and shows per-recipient status → next report's window starts at the previous period_end. Below-tier account sees the gates.
