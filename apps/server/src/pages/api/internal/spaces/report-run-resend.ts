// /api/internal/spaces/:spaceId/reports/runs/:runId/resend  (POST)
//   Re-sends the failed deliveries for a run. The report stays `generated`; each
//   previously-failed (recipient, format) row is re-attempted and flipped to
//   sent/failed again.
//
// server-reports task 3.3 / 5.

import type { AppLocals, Env } from "../../../../env";
import {
  getRun,
  getDefinition,
  listFailedDeliveries,
  markDelivery,
} from "../../../../lib/reports/store";
import { buildReportEmail } from "../../../../lib/reports/delivery";
import { sendReportEmail } from "../../../../lib/reports/email";
import type { ReportRecipient } from "../../../../db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesReportRunResendHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  runId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId) || !UUID_RE.test(runId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();
  const run = await getRun(db, spaceId, runId);
  if (!run) return jsonResponse({ error: "not_found" }, 404);

  const failed = await listFailedDeliveries(db, runId);
  if (failed.length === 0) return jsonResponse({ ok: true, resent: 0, failed: 0 }, 200);

  const def = await getDefinition(db, spaceId, run.reportDefinitionId);
  const recipients = ((def?.scheduleRecipients ?? []) as ReportRecipient[]).reduce(
    (acc, r) => acc.set(r.email, r),
    new Map<string, ReportRecipient>(),
  );

  const base = (env.PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const viewUrl = `${base}/spaces/${spaceId}/reports/runs/${runId}`;
  const manageUrl = `${base}/spaces/${spaceId}/reports`;

  let resent = 0;
  let stillFailed = 0;
  const now = new Date();

  for (const delivery of failed) {
    const email = buildReportEmail({
      reportName: def?.name ?? "Report",
      windowStart: run.windowStart.toISOString(),
      windowEnd: run.windowEnd.toISOString(),
      formats: [delivery.format as "pdf" | "html"],
      viewUrl,
      manageUrl,
      recipientName: recipients.get(delivery.recipientEmail)?.name,
    });
    try {
      await sendReportEmail(env, { to: delivery.recipientEmail, ...email });
      await markDelivery(db, delivery.id, "sent", { now });
      resent += 1;
    } catch (err) {
      await markDelivery(db, delivery.id, "failed", {
        error: err instanceof Error ? err.message : String(err),
        now,
      });
      stillFailed += 1;
    }
  }

  return jsonResponse({ ok: true, resent, failed: stillFailed }, 200);
}
