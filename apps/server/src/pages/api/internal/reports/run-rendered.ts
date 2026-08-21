// /api/internal/reports/runs/:runId/rendered  (POST)
//   The workflow render leg's callback. NOT space-scoped — the task only knows
//   the runId. Records artifact locations, flips generation_state → generated
//   (or failed), then delivers to the definition's recipients. A delivery
//   failure never fails the callback (best-effort; failed rows are re-sendable).
//
// server-reports task 3.4 / 5. INTERNAL_TOKEN gate applied by middleware.

import type { AppLocals, Env } from "../../../../env";
import {
  getRunById,
  getDefinition,
  markRunFailed,
  recordRendered,
} from "../../../../lib/reports/store";
import { deliverReport } from "../../../../lib/reports/delivery";
import { productionDeliverDeps } from "../../../../lib/reports/deps";
import type { ReportRecipient } from "../../../../db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function appBase(env: Env): string {
  return (env.PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

export async function reportsRunRenderedHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  locals: AppLocals,
  runId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(runId)) return jsonResponse({ error: "invalid_request" }, 400);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const body = raw as {
    pdfLocation?: unknown;
    htmlLocation?: unknown;
    error?: unknown;
  };

  const { db } = locals.getMasterDb();
  const run = await getRunById(db, runId);
  if (!run) return jsonResponse({ error: "not_found" }, 404);

  // Render failure reported by the task.
  if (typeof body.error === "string" && body.error) {
    await markRunFailed(db, runId, body.error);
    return jsonResponse({ ok: true, state: "failed" }, 200);
  }

  const pdfLocation = typeof body.pdfLocation === "string" ? body.pdfLocation : null;
  const htmlLocation = typeof body.htmlLocation === "string" ? body.htmlLocation : null;
  await recordRendered(db, runId, { pdfLocation, htmlLocation, now: new Date() });

  // Deliver (best-effort — never fails the callback). Runs after the response is
  // committed via waitUntil so a slow mail relay doesn't hold the render task.
  const deliver = async () => {
    try {
      const def = await getDefinition(db, run.spaceId, run.reportDefinitionId);
      if (!def || !def.scheduleCadence) return; // manual-only → no auto-delivery
      const recipients = (def.scheduleRecipients ?? []) as ReportRecipient[];
      if (recipients.length === 0) return;
      const formats = (def.scheduleFormats ?? ["pdf"]).filter(
        (f): f is "pdf" | "html" => f === "pdf" || f === "html",
      );
      const base = appBase(env);
      const viewUrl = `${base}/spaces/${run.spaceId}/reports/runs/${runId}`;
      const manageUrl = `${base}/spaces/${run.spaceId}/reports`;
      const hadActivity = run.backupsOk > 0 || run.backupsFailed > 0 || run.status === "issues";
      await deliverReport(
        {
          runId,
          reportName: def.name,
          windowStart: run.windowStart.toISOString(),
          windowEnd: run.windowEnd.toISOString(),
          recipients,
          formats,
          suppressEmpty: def.scheduleSuppressEmpty,
          hadActivity,
          viewUrl,
          manageUrl,
        },
        productionDeliverDeps(env, db),
      );
    } catch {
      // Delivery is best-effort; the generated report stands regardless.
    }
  };
  ctx.waitUntil(deliver());

  return jsonResponse({ ok: true, state: "generated" }, 200);
}
