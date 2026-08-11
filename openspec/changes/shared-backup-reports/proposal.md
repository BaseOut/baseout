## Why

The ui-only [`reports-page`](../../../../ui-only/openspec/changes/reports-page/) change builds the Reports surface: a periodic **"what happened since the last report"** document (backup runs + issues, connection health, schema health, documentation updates), viewable in-app, exportable to PDF/HTML, and **emailed on a schedule**. All of that content already exists in the system (backup_runs + run audit, connection status, per-Space health scores, `bo_at_documents` update times) — but nothing assembles it, nothing schedules it, nothing renders PDF, and nothing emails customers non-auth mail. This spans master-DB tables (web-owned) + generation/render/delivery (server) — hence `shared-*`. No workflows leg: PDF rendering uses the **Cloudflare Browser Rendering** binding directly from the engine Worker, so nothing here outgrows the Worker budget.

## What Changes

- **Master DB (canonical migrations in apps/web)**: `report_schedules` (space_id, cadence `after_backup|daily|weekly|monthly` + time-of-day/day-of-week, recipients JSON, formats `pdf|html_link`, enabled, last/next run bookkeeping) and `report_runs` (space_id, schedule_id nullable = manual, period_start/end, trigger, status `generating|complete|failed`, content location, artifact locations, delivery status JSON, error). The engine mirrors what it needs per the established mirror-with-header-comment rule.
- **Report assembly (engine, `apps/server`)**: a generator that, for a window `(last report end, now]`, collects — backup runs + outcomes + per-entity issues (master `backup_runs` + run audit), connection health events, schema-health snapshot + schema changes (`bo_at_health_*`, `bo_at_schema_updates`), and docs created/updated (`bo_at_documents`) — into a **structured JSON report document** (single source for all renderings). Manual runs may override the window (marked `ad_hoc`, chain not advanced).
- **Scheduling (engine)**: cadence evaluation on the existing per-Space scheduler path (SpaceDO/cron) → creates a `report_runs` row and enqueues generation; `after_backup` hooks the run-completion path.
- **Render + delivery (engine, `apps/server`)**: JSON → self-contained HTML (pure template module) → **PDF via the Cloudflare Browser Rendering binding + `@cloudflare/playwright`** (`page.setContent(html)` → `page.pdf()`); artifacts stored; delivery emails recipients (PDF attached and/or HTML link) through the product's transactional email path — **not** the marketing Mailgun stack — recording per-recipient status. New `browser` binding in `apps/server/wrangler.jsonc`.
- **Engine/web API**: report list/detail (structured JSON for the interactive view), generate-now, schedule CRUD (recipient email validation server-side), artifact download URLs. `INTERNAL_TOKEN`-gated engine routes; `apps/web` proxy routes + capability gating land with the UI port (`web-reports-page` follow-up).
- **Clickable references**: the JSON report carries typed refs (`{kind: base|table|field|run|doc|destination, id}`) so the web view resolves them to sidebars/links and exports resolve them to app deep-links — renderers never parse prose.

## Capabilities

### New Capabilities
- `backup-reports`: windowed report assembly (backup/connection/schema-health/docs sections), schedules with email delivery, PDF/HTML artifacts, and the list/detail/generate/schedule API.

### Modified Capabilities
<!-- Consumes existing run-audit, health, and docs data; adds no new capture. -->

## Impact

- **apps/web**: canonical migrations for `report_schedules` + `report_runs`; later proxy/UI via `web-reports-page`.
- **apps/server**: `report-assemble.ts` (pure section builders + window math), `report-html.ts` (pure template), `report-pdf.ts` (Browser Rendering + `@cloudflare/playwright` behind a `renderPdf(html)` interface), `report-deliver.ts` (transactional email + per-recipient status), schedule evaluation on SpaceDO/cron, `after_backup` hook, routes (`reports.ts`, `report.ts`, `report-generate.ts`, `report-schedules.ts`). New wrangler `browser` binding + `@cloudflare/playwright` dependency.
- **Security**: recipients are customer-supplied external emails — server-side validation, per-schedule recipient cap, unsubscribe/plain-footer note in design; report content crosses from per-Space DB to email, which is an intentional, user-configured export of their own data. Artifacts stored Space-scoped; download URLs authorized web-side.
- **Tests first**: window math, section builders, cadence evaluation, HTML snapshot (the PDF step is `renderPdf(html)` behind an interface — mocked in unit tests, exercised in the deployed smoke), delivery status recording.
- **Pairs with**: ui-only [`reports-page`](../../../../ui-only/openspec/changes/reports-page/) (UI), `web-reports-page` follow-up (proxy + gating + port).
