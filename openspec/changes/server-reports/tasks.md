# Tasks — server-reports (engine half)

Nothing built yet. Blocked on the canonical migration in [`web-reports-page`](../web-reports-page/)
(task 1). Pairs with [`workflows-reports`](../workflows-reports/) for the render leg. Reconciles the
engine portions of [`shared-backup-reports`](../shared-backup-reports/).

## 1. Schema mirrors

- [x] 1.1 `report-definitions.ts`, `report-runs.ts`, `report-deliveries.ts` mirrors under
      `apps/server/src/db/schema/` — each with the canonical-migration header comment (§5.3),
      only the columns the engine reads/writes, added to the schema barrel. Never migrate from here.

## 2. Assembly (pure modules — tests first, §3.4)

- [x] 2.1 Window math: `window kind → [start, end)`; `since_last` chain advance; first-report;
      `rolling{days}`; `all_time`; ad-hoc no-advance; failed-run no-advance.
      (`src/lib/reports/window.ts` — `selectChainAnchor` isolates ad-hoc/failed no-advance.)
- [x] 2.2 Cadence math: `next_run_at` for `weekly`/`monthly` (day-of-week, day-of-month, month/year
      edges); event cadences (`data_backup`/`schema_backup`) carry no clock. (`src/lib/reports/
      cadence.ts` — computed in UTC; the schedule-time **timezone/DST is an unresolved open question**
      per design and is flagged in the module for the human.)
- [x] 2.3 Six section builders — `backups`, `connections` (current + observed, gap noted when
      transition history is thin), `schema`, `docs`, `trends`, `dataHealth`. Empty sections emit the
      clean state. Trends/DataHealth are stubbed pending the new capture (task 6). (`src/lib/reports/
      sections.ts`.)
- [x] 2.4 Document assembler → versioned `ReportDetail` JSON: `schemaVersion`, status strip with
      `Delta`s vs the prior run, typed entity refs (`{kind, id, label}` on rows), section scoping to the
      definition's `sections`. (`src/lib/reports/assemble.ts` + `types.ts`.)

## 3. Report API (`INTERNAL_TOKEN`-gated)

> NOTE: the engine test pool has **no real Postgres** (`vitest.config.ts` ships a
> dummy `DATABASE_URL`; "PR2" not landed). So route coverage is `SELF.fetch`
> guard tests (token/method/UUID) + pure DI tests for the orchestration/validation
> — not real-DB integration. (`tests/integration/reports/report-routes.test.ts`.)

- [x] 3.1 Definition CRUD under `/api/internal/spaces/[spaceId]/reports/`: `GET` list (+ latest run
      per definition), `POST` create (server-side recipient validation; reject deleting the default),
      `GET/PATCH/DELETE [defId]`. (`reports.ts` + `report.ts`; `store.ts`, `validate.ts`. PATCH is a
      full-body replace of editable fields.)
- [x] 3.2 `POST [defId]/generate` — run-now with optional window override (→ `ad_hoc`, chain not
      advanced); inserts the run(running) + enqueues assembly; honours the one-running guard.
      (`report-generate.ts` → pure `generate.ts` orchestrator + `deps.ts`.)
- [x] 3.3 `GET runs/[runId]` (rendered document JSON) + `GET runs/[runId]/artifact?format=pdf|html`
      (resolve/stream a Space-scoped artifact) + `POST runs/[runId]/resend` (re-send failed
      deliveries). (`report-run.ts`, `report-run-artifact.ts`, `report-run-resend.ts`. Document +
      artifacts stored in `BACKUPS_R2` via `report-storage.ts`; absent binding → 503, a documented
      dependency like EMAIL.)
- [x] 3.4 `POST /api/internal/reports/runs/[runId]/rendered` — the workflow callback: record artifact
      locations, flip `generation_state`, then deliver. (`reports/run-rendered.ts`; delivery deferred
      via `waitUntil`.) **Pairs with `workflows-reports`** — the render task BODY (which POSTs here)
      ships in that change; the engine enqueues `render-report` with the payload/callback contract
      defined here (`trigger-client.ts` `enqueueRenderReport`/`RenderReportPayload`).

## 4. Scheduling (engine)

- [x] 4.1 `weekly`/`monthly` evaluation → due `next_run_at` → insert `report_runs(running)` +
      enqueue assembly; recompute `next_run_at`. Implemented as an **hourly cron sweep**
      (`sweep.ts` `runScheduledReportSweep`, registered under `WEBHOOK_RENEWAL_CRON` in `cron/
      dispatch.ts` + `scheduled()`), not the SpaceDO alarm — the cron seam matches the reconciliation
      sweep and uses the `next_run_at` partial index directly. A report due at HH:MM fires within the
      hour. Pure due-selection tested (`schedule.ts` `dueClockReports`).
- [x] 4.2 `after_backup` hook on the run-completion path, keyed on `backup_runs.kind` — `data_backup`
      after `kind='full'`, `schema_backup` after `kind='schema'`. Wired best-effort in the
      `runsCompleteHandler` `finalized` branch via `waitUntil` (`after-backup.ts` `fireEventReports`).
      Debounce = the one-running-per-definition guard (a definition already generating is skipped).
      Pure selection tested (`schedule.ts` `reportsToFireAfterBackup`).

## 5. Delivery (engine — new `EMAIL` binding)

- [x] 5.1 Added the `EMAIL` `send_email` binding + `EMAIL_FROM`/`PUBLIC_APP_URL` vars to
      `wrangler.jsonc.example` (top-level + non-inheritable `env.dev`) and `env.d.ts`. Per-recipient
      send via the transactional rail (`email.ts` mirrors web's `sendEmail`); one `report_deliveries`
      row per (recipient, format); recipient cap (25, `validateRecipients`); schedule-footer manage
      link; `suppress_empty` respected. **Deviation (flagged):** delivery is **link-only** (email
      carries authorized download links to the web app) rather than PDF attachments — sidesteps the
      attachment-size fallback entirely and keeps the Worker send small; the design's
      "attachment-and/or-link" is satisfied by the link path. Failed sends are re-sendable
      (`report-run-resend.ts`). **Not done:** bounded DO-alarm retry on transient send errors —
      re-send is manual-only for now (flagged as a follow-up; the failure rows carry the reason).
      Sending to external recipients requires the verified sender domain (`mail.baseout.com`).

## 6. Historical capture (Trends / Data health) — see open questions

- [x] 6.1 **Deferred to a follow-up** (as the task allows). The Trends/DataHealth builders are
      **stubbed** — they emit an `available:false` clean state with a "not enough history / capture
      not landed" note (`sections.ts` `buildTrendsStub`/`buildDataHealthStub`), so a definition that
      requests them renders honestly rather than fabricating series. The per-backup metric snapshot
      capture is NOT built here; file it as a follow-up when the Data page work is ready.

## 7. Capability gating

- [x] 7.1 `gate.ts` `checkReportCreationGate` (engine-side defense-in-depth; the user-facing
      `checkCreationCap` lives in apps/web). Enforces the **`active_reports` creation cap** via
      `resolveEntitlements` + `canCreate` (org-scoped, non-default definitions), behind
      `ENTITLEMENT_ENFORCEMENT` (dark by default, fails open on a resolution gap). **FLAGGED SPEC
      CONFLICT (not invented):** the DB-native catalog has ONLY `active_reports` (Features §216
      per-tier quota + add-on `reports_5`); there is **no feature slug** for Custom-Reports
      availability / Scheduled Delivery / Export (§795/§798/§799). So those availability checks are
      **wired but inert (fail open)** until a human adds the slugs and resolves §216-vs-§795 — see the
      boxed flag in `gate.ts`.

## 8. Verification

- [x] 8.1 **Local verification green:** `pnpm --filter @baseout/server typecheck` (tsc, exit 0),
      `build` (tsup, exit 0), the full reports suite + `runs-complete` (88 tests, 10 files) green, no
      stray `console.*`/`debugger`; `pnpm --filter @baseout/web typecheck` green; `0038_reports.sql`
      applied to dev DB + `db:check` clean + backfill verified (13 Spaces → 13 default reports).
      **Deployed end-to-end smoke NOT yet run** — it needs (a) the `workflows-reports` render leg
      (paired change) to POST the `/rendered` callback, (b) `BACKUPS_R2` bound for document/artifact
      storage, and (c) the `EMAIL` verified sender for real delivery. Until then the engine half is
      smoke-able piecemeal: create/generate a definition → run row goes `running` + document stored;
      manually POST the `/rendered` callback → run flips `generated` + `report_deliveries` written.
      Deferred to the deployed smoke once the paired changes land.
