// /api/internal/spaces/:spaceId/reports/runs/:runId  (GET)
//   Returns the rendered ReportDetail document JSON for a run (from storage),
//   plus the run row for lifecycle fields the web view merges in.
//
// server-reports task 3.3.

import type { AppLocals, Env } from "../../../../env";
import { getRun } from "../../../../lib/reports/store";
import { getDocument, StorageUnavailableError } from "../../../../lib/reports/report-storage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesReportRunHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  runId: string,
): Promise<Response> {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId) || !UUID_RE.test(runId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();
  const run = await getRun(db, spaceId, runId);
  if (!run) return jsonResponse({ error: "not_found" }, 404);

  // Still running / failed → no document yet; return the run row so the caller
  // can render the pending/failed state.
  if (!run.documentLocation) {
    return jsonResponse({ ok: true, run, document: null }, 200);
  }

  try {
    const document = await getDocument(env.BACKUPS_R2, run.documentLocation);
    if (!document) return jsonResponse({ error: "document_missing" }, 404);
    return jsonResponse({ ok: true, run, document }, 200);
  } catch (err) {
    if (err instanceof StorageUnavailableError) {
      return jsonResponse({ error: "storage_unavailable" }, 503);
    }
    throw err;
  }
}
