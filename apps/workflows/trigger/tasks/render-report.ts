// Report render orchestration (pure, tests first) — workflows-reports task 3.1.
//
// Renders the requested formats from the ONE engine-assembled document and
// writes each artifact through the injected StorageWriter under a Space-scoped
// prefix. Never touches the DB, a browser, or storage directly — all injected —
// so it unit-tests with a fake writer + a mocked renderPdf. The task wrapper
// (render-report.task.ts) supplies the real deps and owns the callback POST.

import type { StorageWriter } from "./_lib/storage-writer";
import type { RenderPdf } from "./_lib/report-pdf";
import type { RenderHtmlContext } from "./_lib/report-html";
import type { ReportDetail } from "./_lib/report-types";

export interface RenderReportInput {
  runId: string;
  spaceId: string;
  document: ReportDetail;
  /** Render only what the schedule asked for (>=1 of pdf|html). */
  formats: ("pdf" | "html")[];
  /** apps/web origin for deep-links in the artifacts. */
  appBaseUrl?: string;
  reportName?: string;
}

export interface RenderReportResult {
  runId: string;
  pdfLocation: string | null;
  htmlLocation: string | null;
  status: "rendered" | "failed";
  error?: string;
}

export interface RenderReportDeps {
  renderHtml: (doc: ReportDetail, ctx: RenderHtmlContext) => string;
  renderPdf: RenderPdf;
  writer: StorageWriter;
}

/** Space-scoped artifact prefix — same rail shape as backups. */
function artifactKey(spaceId: string, runId: string, ext: "html" | "pdf"): string {
  return `reports/${spaceId}/${runId}/report.${ext}`;
}

const HTML_ENCODER = new TextEncoder();

export async function renderReport(
  input: RenderReportInput,
  deps: RenderReportDeps,
): Promise<RenderReportResult> {
  const wants = new Set(input.formats);
  let pdfLocation: string | null = null;
  let htmlLocation: string | null = null;

  try {
    // The HTML is the source for both the HTML export and the PDF, so render it
    // once whenever either format is requested.
    const needsHtmlString = wants.has("html") || wants.has("pdf");
    const html = needsHtmlString
      ? deps.renderHtml(input.document, {
          appBaseUrl: input.appBaseUrl,
          spaceId: input.spaceId,
          reportName: input.reportName,
        })
      : "";

    if (wants.has("html")) {
      const key = artifactKey(input.spaceId, input.runId, "html");
      const { path } = await deps.writer.writeBlob(
        key,
        HTML_ENCODER.encode(html),
        "text/html; charset=utf-8",
      );
      htmlLocation = path;
    }

    if (wants.has("pdf")) {
      const pdf = await deps.renderPdf(html);
      const key = artifactKey(input.spaceId, input.runId, "pdf");
      const { path } = await deps.writer.writeBlob(key, pdf, "application/pdf");
      pdfLocation = path;
    }

    return { runId: input.runId, pdfLocation, htmlLocation, status: "rendered" };
  } catch (err) {
    return {
      runId: input.runId,
      pdfLocation,
      htmlLocation,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
