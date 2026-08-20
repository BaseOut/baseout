// Trigger.dev task wrapper for render-report (workflows-reports task 3.2).
//
// The pure orchestration lives in ./render-report.ts so tests import it without
// the Trigger.dev SDK. This file is what the runner picks up: it reads
// BACKUP_ENGINE_URL + INTERNAL_TOKEN from process.env, resolves a real
// StorageWriter, renders via the pure function, and POSTs the artifact locations
// + status to /api/internal/reports/runs/:runId/rendered (fire-and-forget on
// transport error — the engine's run-row state machine is the safety net).

import { task } from "@trigger.dev/sdk";
import { resolveStorageWriter } from "./_lib/storage-writers";
import { renderHtml } from "./_lib/report-html";
import { chromiumRenderPdf } from "./_lib/report-pdf";
import { renderReport } from "./render-report";
import type { ReportDetail } from "./_lib/report-types";

/**
 * Enqueue payload (canonical — the engine imports this type and passes the
 * assembled document INLINE so the render leg needs no cross-app storage read).
 */
export interface RenderReportPayload {
  runId: string;
  spaceId: string;
  document: ReportDetail;
  formats: ("pdf" | "html")[];
  /** storage_type from the Space's backup config; defaults to local-fs. */
  storageType?: string;
  /** apps/web origin for deep-links in the artifacts. */
  appBaseUrl?: string;
  reportName?: string;
}

export interface RenderReportCallbackBody {
  runId: string;
  pdfLocation: string | null;
  htmlLocation: string | null;
  status: "rendered" | "failed";
  error?: string;
}

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

async function postRendered(
  engineUrl: string,
  internalToken: string,
  body: RenderReportCallbackBody,
): Promise<void> {
  const url = `${trimSlash(engineUrl)}/api/internal/reports/runs/${encodeURIComponent(
    body.runId,
  )}/rendered`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "x-internal-token": internalToken,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Fire-and-forget: the engine's run-row state machine reconciles a lost
    // callback; a retried POST is not the recovery path (design §Callback).
  }
}

export const renderReportTask = task({
  id: "render-report",
  maxDuration: 300,
  run: async (payload: RenderReportPayload) => {
    const engineUrl = process.env.BACKUP_ENGINE_URL;
    const internalToken = process.env.INTERNAL_TOKEN;
    if (!engineUrl) throw new Error("BACKUP_ENGINE_URL is not set in the Trigger.dev env");
    if (!internalToken) throw new Error("INTERNAL_TOKEN is not set in the Trigger.dev env");

    const result = await renderReport(
      {
        runId: payload.runId,
        spaceId: payload.spaceId,
        document: payload.document,
        formats: payload.formats,
        appBaseUrl: payload.appBaseUrl ?? process.env.PUBLIC_APP_URL,
        reportName: payload.reportName,
      },
      {
        renderHtml,
        renderPdf: chromiumRenderPdf,
        writer: resolveStorageWriter(payload.storageType ?? "local_fs"),
      },
    );

    await postRendered(engineUrl, internalToken, {
      runId: result.runId,
      pdfLocation: result.pdfLocation,
      htmlLocation: result.htmlLocation,
      status: result.status,
      error: result.error,
    });

    return result;
  },
});
