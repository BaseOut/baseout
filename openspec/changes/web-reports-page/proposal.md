## Why

The engine side of Reports ([`shared-backup-reports`](../shared-backup-reports/)) assembles windowed report documents (backup summary · connection health · schema health · docs updates), schedules them, renders HTML/PDF via Browser Rendering, and emails recipients — and `apps/web` already owns the canonical `report_schedules`/`report_runs` migrations from that change. But `/reports` still renders a `PlaceholderView`. The ui-only [`reports-page`](../../../../ui-only/openspec/changes/reports-page/) change defines the Reports UI (report list, Run report now, schedules, the sectioned report view). This change is the web half: proxy routes, capability gating, artifact download authorization, and the port — filed per shared-backup-reports task 5.2.

## What Changes

- **Build out `/reports`** (nav item already exists): report list (period covered, generated-at, trigger — manual/scheduled, delivery status), **Run report now**, and **Schedules** management (cadence, recipients, format, enable/pause).
- **Proxy routes** under `/api/spaces/:spaceId/reports/*` forwarding to the engine's `INTERNAL_TOKEN`-gated report routes via the `BACKUP_ENGINE` service binding: list, detail (the versioned JSON report document), generate-now, schedule CRUD (recipient email validation server-side, recipient cap enforced), and **artifact downloads** — web authorizes the session + Space membership, then resolves the artifact (R2, Space-scoped prefix) through the engine and streams it; artifact URLs are never exposed unauthorized.
- **Web client methods** on `backup-engine.ts` + view types (report summary/document/schedule shapes with the document's typed entity refs `{kind, id, label}`).
- **Report detail view**: renders the JSON document's four sections; every typed ref is clickable — schema entities open the shared entity detail sidebar, backup runs open run detail, docs open the doc, external destination copies link out. Empty sections render their "clean" state, never omitted.
- **Capability gating** from Stripe metadata via `tier-capabilities.ts` (Features §5.5): manual run + in-app view vs scheduled email delivery are **separate** checks; schedule endpoints reject below-tier writes server-side. Reconcile the exact tier mapping with the Features matrix during implementation — flag, don't invent.
- **Port of the ui-only `ReportsView`** through the ui-sync promotion workflow (`shared/internal/ui-sync.md`), retiring the `PlaceholderView` for this route.

## Capabilities

### New Capabilities
- `reports-page`: the Reports page — report list, on-demand generation, the sectioned report view with clickable entity references, authorized PDF/HTML artifact downloads, and schedule management for automated email delivery.

### Modified Capabilities
<!-- Nav item already exists; this replaces the placeholder view. Consumes shared-backup-reports. -->

## Impact

- `apps/web/src/lib/backup-engine.ts` — report client methods + view types.
- Proxy routes: `pages/api/spaces/[spaceId]/reports/*` (list, detail, generate-now, schedules CRUD, artifact download) — middleware-guarded + capability-gated, route tests first (per §3.4).
- `ReportsView.astro` + report detail view — ported per strict two-tier component governance; reuses the shared entity sidebar, run detail links, StatusBadge, period picker filter menus, `setButtonLoading` on Run/Export.
- **Blocked on**: `shared-backup-reports` §2–§5 (engine assembly/scheduling/render/delivery routes; the web-owned migrations land there).
- **Pairs with**: ui-only [`reports-page`](../../../../ui-only/openspec/changes/reports-page/), [`shared-backup-reports`](../shared-backup-reports/).
- No engine logic here — proxy + gating + download authorization + UI only. No new migrations (canonical tables ship with the parent change).
