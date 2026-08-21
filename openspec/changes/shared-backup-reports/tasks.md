# Tasks

> **Superseded in practice by** [`server-reports`](../server-reports/) +
> [`workflows-reports`](../workflows-reports/) + [`web-reports-page`](../web-reports-page/)
> (Phase 8 on `autumn/cursor-ui-implementation-test`, 2026-08-20). The v2 model uses
> `report_definitions` (embedded schedule) rather than separate `report_schedules`.
> Keep this file for the historical umbrella; mark progress against the per-app changes.

## 1. Data model (web-owned migrations)

- [x] 1.1 Canonical tables landed as `report_definitions` + `report_runs` + `report_deliveries`
      (migration `0038_reports`) — see `web-reports-page` §1 / `server-reports` §1. (Old task name
      `report_schedules` was folded into definitions.)

## 2. Assembly (engine, tests first)

- [x] 2.1 Window math — `server-reports` §2.1.
- [x] 2.2 Section builders — `server-reports` §2.3–2.4.
- [x] 2.3 Generator route — `server-reports` §3 + workflows render leg.

## 3. Scheduling (engine)

- [x] 3.1 Cadence + sweep — `server-reports` §2.2 / §4.
- [x] 3.2 `after_backup` — `server-reports` (complete.ts waitUntil).

## 4. Render + delivery

- [x] 4.1 HTML + PDF — `workflows-reports` (PDF env-gated / lazy browser dep).
- [x] 4.2 Delivery — `server-reports` delivery module (EMAIL binding optional).

## 5. API

- [x] 5.1 Engine routes — `server-reports` §3.
- [x] 5.2 `web-reports-page` filed + implemented (proxies + UI Phase 8).

## 6. Verification

- [x] 6.1 Automated: server reports 73 · workflows render 9 · web reports 12. Human smoke + migrate
      `0038` still required before LIVE demo.
