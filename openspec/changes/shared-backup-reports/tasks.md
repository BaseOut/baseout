# Tasks

## 1. Data model (web-owned migrations)

- [ ] 1.1 `report_schedules` + `report_runs` tables (canonical migration in apps/web; engine mirrors with header comments). One-`generating`-per-Space guard on report_runs.

## 2. Assembly (engine, tests first)

- [ ] 2.1 Window math (pure): chain advance, first-report, ad-hoc no-advance, failed-run no-advance.
- [ ] 2.2 Section builders (pure): backup summary (runs + per-entity issues), connection health (transitions or current+observed with the gap noted), schema health (score + delta + issues + schema updates), docs updates. `{status:"clean"}` for empty sections. Versioned report-document schema with typed refs.
- [ ] 2.3 Generator route + `report-generate` flow: insert run row → assemble → store JSON → render + deliver (engine-local, §4).

## 3. Scheduling (engine)

- [ ] 3.1 Cadence math (pure, unit-tested) + `next_run_at` on save; due-schedule evaluation on the SpaceDO/cron tick.
- [ ] 3.2 `after_backup` trigger on run completion, debounced per Space.

## 4. Render + delivery (engine — Browser Rendering, no workflows leg)

- [ ] 4.1 `report-html.ts`: self-contained HTML template (inline CSS, deep-links from typed refs) — pure, snapshot-tested. `report-pdf.ts`: `renderPdf(html)` over the **Browser Rendering binding + `@cloudflare/playwright`** (`page.setContent` → `page.pdf`, print headers/footers); wrangler `browser` binding added; unit tests mock `renderPdf`; bounded retry on session-limit errors. Artifacts to Space-scoped storage; run row updated.
- [ ] 4.2 `report-deliver.ts`: per-recipient email via the transactional path (PDF as MIME attachment and/or HTML link; attachment-size fallback to link-only, noted in status), per-recipient status onto `report_runs.delivery`; recipient cap; schedule-footer note.

## 5. API

- [ ] 5.1 Engine routes (INTERNAL_TOKEN): report list/detail (JSON document), generate-now (window override → ad_hoc), schedule CRUD (server-side recipient email validation, cap), artifact URL resolution. Integration tests against real Postgres + Miniflare.
- [x] 5.2 File `web-reports-page` follow-up when the ui-only `reports-page` UI ports (proxy routes, capability gating via the resolver, download authorization). Filed 2026-07-13: [`web-reports-page`](../web-reports-page/).

## 6. Verification

- [ ] 6.1 Typecheck + build green; suites green. Smoke: run a backup with a forced per-entity failure → generate report → all four sections correct (failure listed with error text), clean sections say clean → render HTML + PDF → schedule with two recipients → both receive, delivery status recorded → next report's window starts at the previous period_end.
