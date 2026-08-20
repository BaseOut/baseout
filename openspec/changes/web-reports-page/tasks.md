## Status

Phase 8 landed on `autumn/cursor-ui-implementation-test` (backend port `fdfd1e90` from
`4d3ff862` + UI promotion this change). Engine API + proxies + ui-only views + nav restore.
Migration `0038_reports` present but **not** applied to remote/dev DBs — see Caveats.

---

## 1. Data model (web-owned canonical migration)

- [x] 1.1 `report_definitions` + `report_runs` + `report_deliveries` in `core.ts` + migration
      `0038_reports.sql` (data model in `server-reports/design.md`): partial-unique one-default-per-Space,
      one-running-per-definition guard, `next_run_at` index. `db:check` clean. (Landed via `/opsx:apply
      server-reports` to unblock the engine half.)
- [x] 1.2 Default-report creation: backfill a non-deletable "Full &lt;Space&gt; Report" for every
      existing Space (in-migration `INSERT … SELECT`, idempotent) + a web-side hook in
      `createSpaceForOrg` and the onboarding tx (`lib/reports/default-report.ts`). (Open question
      resolved: web-side insert, in the Space-creation transaction.)

## 2. Web client + proxy routes (tests first, §3.4)

- [x] 2.1 `backup-engine.ts` — client methods + view types matching `lib/reports/types.ts`:
      `listReportDefinitions`, `getReportDefinition`, `createReportDefinition`,
      `updateReportDefinition`, `deleteReportDefinition`, `generateReportNow`, `getReportRun`
      (rendered document), `getReportArtifact`, `resendReportDelivery`.
- [x] 2.2 Proxy routes under `pages/api/spaces/[spaceId]/reports/` — middleware-guarded +
      capability-gated: `index.ts` (GET/POST), `[reportId].ts` (GET/PATCH/DELETE — DELETE rejects the
      default; recipient validation server-side), `[reportId]/generate.ts` (POST),
      `runs/[runId].ts` (GET document), `runs/[runId]/artifact.ts` (GET — authorize session + Space
      membership, resolve via engine, stream PDF/HTML), `runs/[runId]/resend.ts` (POST). Per-file
      route tests (403 below tier, 400 invalid recipients, artifact requires membership, DELETE
      default rejected, engine passthrough shape).
- [x] 2.3 Gating: `checkCreationCap(orgId, 'active_reports')` on create; engine-side gate flags
      Features §216-vs-§795 conflict (scheduled-delivery / export slugs inert until catalog adds them).

## 3. Reports UI (promote via `/ui-sync`)

- [x] 3.1 Catalog prereqs: `ui/{Table,TrendChart,UndoToast}` (+stories+classification),
      `PanelHost`/`FacetFilter`/`tableSort`/`entityIcon`/`schemaEntities`/`time`/`ui`/`refineCollapse`
      present; `schema/EntityPanel` = Phase 8 honest-gate stub (full Schema drawer = Phase 9).
- [x] 3.2 Promoted `lib/reports/{types,view,view2,deleteReport,mapFromEngine,clientApi}` +
      `components/reports/{RecipientInput,ReportBodyKpi}` +
      `views/{ReportsView,ReportDefinitionView,ReportDetailView}` from ui-only tip.
- [x] 3.3 SSR loaders: `/reports`, `/reports/[id]`, `/reports/run/[runId]`. Run/Save/Delete/Export
      wired to proxies (`setButtonLoading` on generate/save). `shared/internal/ui-sync.md` updated.

## 4. Un-hide (reverse web-v1-scope-trim)

- [x] 4.1 Re-add Reports to `app-config.json` `navigation.top` (Space group; `lucide--file-text`).
- [x] 4.2 Replace `/reports` 302 with SSR list; design harness list page restored (views via `@web`).
- [ ] 4.3 Add the superseding note to `web-v1-scope-trim` and confirm the PRD §10 revision path with
      Dan (open question).

## 5. Verification

- [x] 5.1 Backend tests green (server 73 · workflows 9 · web reports 12). Classification/story fixes
      for new ui/reports components. Full `audit:components` / `astro check` / `pnpm install`
      (apexcharts) may need a local reinstall — see commit Caveats.
- [ ] 5.2 Human smoke: after `db:migrate` + engine deploy — sidebar Reports → list → Run now →
      History → export → Settings save → schedule delivery. EntityPanel = Phase 8 stub note.
      PDF needs Trigger.dev render env.
