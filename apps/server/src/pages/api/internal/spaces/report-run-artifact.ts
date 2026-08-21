// /api/internal/spaces/:spaceId/reports/runs/:runId/artifact?format=pdf|html  (GET)
//   Streams the rendered PDF/HTML artifact for a run. Space-scoped resolution;
//   download authorization (session + membership) is enforced web-side.
//
// server-reports task 3.3.

import type { AppLocals, Env } from "../../../../env";
import { getRun } from "../../../../lib/reports/store";
import { getArtifact, StorageUnavailableError } from "../../../../lib/reports/report-storage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesReportRunArtifactHandler(
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
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "pdf" && format !== "html") {
    return jsonResponse({ error: "invalid_request", message: "format must be pdf|html" }, 400);
  }

  const { db } = locals.getMasterDb();
  const run = await getRun(db, spaceId, runId);
  if (!run) return jsonResponse({ error: "not_found" }, 404);

  const location = format === "pdf" ? run.artifactPdfLocation : run.artifactHtmlLocation;
  if (!location) return jsonResponse({ error: "artifact_not_ready" }, 404);

  try {
    const obj = await getArtifact(env.BACKUPS_R2, location);
    if (!obj) return jsonResponse({ error: "artifact_missing" }, 404);
    return new Response(obj.body, {
      status: 200,
      headers: {
        "content-type": format === "pdf" ? "application/pdf" : "text/html; charset=utf-8",
      },
    });
  } catch (err) {
    if (err instanceof StorageUnavailableError) {
      return jsonResponse({ error: "storage_unavailable" }, 503);
    }
    throw err;
  }
}
