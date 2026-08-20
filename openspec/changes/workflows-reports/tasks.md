# Tasks — workflows-reports (render leg)

Nothing built yet. Pairs with [`server-reports`](../server-reports/) (assembly + enqueue + callback
+ delivery). Reconciles the render portion of [`shared-backup-reports`](../shared-backup-reports/).

> NOTE: `ReportDetail` is mirrored workflows-local in `_lib/report-types.ts` (the
> engine assembles; this task only renders — same mirror philosophy as the DB
> schema mirrors). The engine passes the document **INLINE** in the payload
> (`RenderReportPayload.document`), so the render leg needs no cross-app storage
> read — the engine's `enqueueRenderReport` + `deps.ts` were aligned to this.

## 1. HTML template (pure — tests first, §3.4)

- [x] 1.1 `_lib/report-html.ts`: pure `renderHtml(document, ctx?)` producing one self-contained HTML
      string (inline CSS, no external assets, no `<script>`/`<link>`), sections in fixed order, per
      `ReportSection` (strip · stats · rows · clean line), typed refs → absolute app deep-links (plain
      text when no base URL). Tested for an issues document (failed base + error text + deep-link) and
      a fully-clean document (clean lines + trends-unavailable note). (`tests/report-html.test.ts`.)

## 2. PDF interface

- [x] 2.1 `_lib/report-pdf.ts`: `RenderPdf` type + `chromiumRenderPdf` (Playwright API shape, print
      CSS, page-number footer). Unit tests mock the interface; the real path is smoke-only. **Dep NOT
      added (open question deferred):** the browser package is imported lazily by name so the module
      typechecks/builds without it and throws a clear error if it isn't installed — add the chosen
      Chromium dep (Playwright/Puppeteer/lighter lib) + wire it before the PDF smoke.

## 3. Pure orchestration + task wrapper

- [x] 3.1 `render-report.ts` (pure): `renderReport(input, { renderHtml, renderPdf, writer })` →
      `{ pdfLocation, htmlLocation, status, error? }`, rendering only the requested `formats` (one HTML
      render reused as the PDF source), writing each artifact via the injected `StorageWriter` under a
      Space-scoped prefix. Tested with a fake writer + mocked `renderPdf` incl. the failure path.
- [x] 3.2 `render-report.task.ts` (thin wrapper): reads `BACKUP_ENGINE_URL` + `INTERNAL_TOKEN`
      (+ `PUBLIC_APP_URL`) from `process.env`, resolves the real `StorageWriter` via `_lib/storage-
      writers` (defaults to local-fs), calls the pure function, POSTs
      `{ pdfLocation, htmlLocation, status, error? }` to `/api/internal/reports/runs/:runId/rendered`
      (fire-and-forget on transport error). `maxDuration: 300`.
- [x] 3.3 `trigger/tasks/index.ts`: type-only re-export of `renderReportTask`, `RenderReportPayload`,
      `RenderReportCallbackBody`, `RenderReportInput`, `RenderReportResult`. The engine's
      `trigger-client.ts` now does `tasks.trigger<typeof renderReportTask>(…)` + re-exports the payload
      type (mirrors the restore-base pattern).

## 4. Verification

- [x] 4.1 `pnpm --filter @baseout/workflows typecheck` (exit 0) + the two new test files (9 tests)
      green (Node pool); no stray `console.*`. Engine re-verified after the contract alignment
      (typecheck exit 0, 88 tests, build green). **Local `trigger.dev dev` smoke NOT yet run** — the
      real PDF path needs the chosen Chromium dep installed (task 2.1); until then unit tests cover the
      orchestration with a mocked renderer. Once the dep lands: `npx trigger.dev dev` + enqueue via the
      engine generate route → run flips `generated` with real PDF + HTML on disk + callback recorded.
