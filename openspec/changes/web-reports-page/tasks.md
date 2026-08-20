## Status

Not started (0/…). Web half + un-hide of Reports, re-scoped to the fork's v2 definition model.
Blocked on [`server-reports`](../server-reports/) (engine API) and depends on the canonical
migration landing here (task 1). Render comes from [`workflows-reports`](../workflows-reports/).
Reverses the Reports-hide of [`web-v1-scope-trim`](../web-v1-scope-trim/); reconciles
[`shared-backup-reports`](../shared-backup-reports/).

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

- [ ] 2.1 `backup-engine.ts` — client methods + view types matching `lib/reports/types.ts`:
      `listReportDefinitions`, `getReportDefinition`, `createReportDefinition`,
      `updateReportDefinition`, `deleteReportDefinition`, `generateReportNow`, `getReportRun`
      (rendered document), `getReportArtifact`, `resendReportDelivery`.
- [ ] 2.2 Proxy routes under `pages/api/spaces/[spaceId]/reports/` — middleware-guarded +
      capability-gated: `index.ts` (GET/POST), `[reportId].ts` (GET/PATCH/DELETE — DELETE rejects the
      default; recipient validation server-side), `[reportId]/generate.ts` (POST),
      `runs/[runId].ts` (GET document), `runs/[runId]/artifact.ts` (GET — authorize session + Space
      membership, resolve via engine, stream PDF/HTML), `runs/[runId]/resend.ts` (POST). Per-file
      route tests (403 below tier, 400 invalid recipients, artifact requires membership, DELETE
      default rejected, engine passthrough shape).
- [ ] 2.3 Gating in the capability resolver: custom-reports availability, scheduled-delivery, and
      export as **separate** `resolveEntitlements` checks; `checkCreationCap(orgId, 'active_reports')`
      on create. Reconcile the Features §216-vs-§795 tier conflict with the human — flag, don't invent.

## 3. Reports UI (promote via `/ui-sync`)

- [ ] 3.1 Confirm the shared-catalog prereqs are present in `apps/web` (`ui/TrendChart`,
      `ui/TablePager`, `ui/ConfirmModal`, `ui/UndoToast`, `ui/PanelHost`, `schema/EntityPanel`,
      `schema/FacetFilter`, `schema/tableSort`, `schema/entityIcon`, `schema/schemaEntities`,
      `lib/{time,ui,refineCollapse}`); promote any missing one first.
- [ ] 3.2 Promote `lib/reports/{types,view,view2,deleteReport}.ts` +
      `components/reports/{RecipientInput,ReportBodyKpi}.astro` +
      `views/{ReportsView,ReportDefinitionView,ReportDetailView}.astro` per ui-sync §4.2 intake order.
- [ ] 3.3 SSR loaders replacing fixtures: `/reports` (list + baseNames + hasBackups),
      `/reports/[id]` (def + runs + latest rendered doc + current-snapshot + members + schema index;
      `new` = blank-def create), `/reports/run/[runId]` (run doc + parent scope). `setButtonLoading`
      on Run now / Save / Export. Update `shared/internal/ui-sync.md` in this change.

## 4. Un-hide (reverse web-v1-scope-trim)

- [ ] 4.1 Re-add the Reports item to `apps/web/app-config.json` `navigation.top` (Space group; icon
      `lucide--file-chart-column`).
- [ ] 4.2 Replace the `apps/web/src/pages/reports.astro` 302-redirect with the real SSR list page;
      confirm the design harness pages come along via the sync.
- [ ] 4.3 Add the superseding note to `web-v1-scope-trim` and confirm the PRD §10 revision path with
      Dan (open question).

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/web typecheck` + `build` green; route tests green;
      `audit:components` clean; no stray `console.*`; mobile at <375/<768/<1024.
- [ ] 5.2 Human smoke: sidebar shows Reports; `/reports` lists definitions; open the default report →
      Most Recent renders → Run now → History gains a row and opens the run document → click a schema
      ref (shared EntityPanel) + a backup-run ref (run detail) → download PDF + HTML → edit Settings
      (sections/scope/window/schedule/recipients) and Save → scheduled run delivers with per-recipient
      status, a forced failure re-sends → below-tier account sees the view/delivery/export gates.
