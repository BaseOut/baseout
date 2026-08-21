// /api/internal/spaces/:spaceId/reports/:defId/generate  (POST)
//   Run-now. Optional { windowStart, windowEnd } override → ad-hoc (chain not
//   advanced). Inserts a running run + assembles + enqueues render, honouring
//   the one-running-per-definition guard.
//
// server-reports task 3.2.

import type { AppLocals, Env } from "../../../../env";
import { generateReport } from "../../../../lib/reports/generate";
import { productionGenerateDeps } from "../../../../lib/reports/deps";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseWindowOverride(
  raw: unknown,
): { start: Date; end: Date } | null | "invalid" {
  if (raw == null || typeof raw !== "object") return null;
  const b = raw as { windowStart?: unknown; windowEnd?: unknown };
  if (b.windowStart == null && b.windowEnd == null) return null;
  if (typeof b.windowStart !== "string" || typeof b.windowEnd !== "string") return "invalid";
  const start = new Date(b.windowStart);
  const end = new Date(b.windowEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "invalid";
  if (start.getTime() >= end.getTime()) return "invalid";
  return { start, end };
}

export async function spacesReportGenerateHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  defId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId) || !UUID_RE.test(defId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  let raw: unknown = {};
  if (request.headers.get("content-length") !== "0") {
    try {
      raw = await request.json();
    } catch {
      raw = {};
    }
  }
  const windowOverride = parseWindowOverride(raw);
  if (windowOverride === "invalid") {
    return jsonResponse({ error: "invalid_request", message: "bad window override" }, 400);
  }

  const triggerBy =
    typeof (raw as { triggerBy?: unknown }).triggerBy === "string"
      ? (raw as { triggerBy: string }).triggerBy
      : undefined;

  const { db } = locals.getMasterDb();
  const deps = productionGenerateDeps(env, db);
  const result = await generateReport(
    {
      definitionId: defId,
      spaceId,
      trigger: { kind: "manual", by: triggerBy },
      windowOverride,
      now: new Date(),
    },
    deps,
  );

  if (result.ok) return jsonResponse({ ok: true, runId: result.runId }, 202);
  if (result.reason === "no_definition") return jsonResponse({ error: "not_found" }, 404);
  if (result.reason === "already_running") {
    return jsonResponse({ error: "already_running" }, 409);
  }
  return jsonResponse({ error: "generation_failed", runId: result.runId }, 500);
}
