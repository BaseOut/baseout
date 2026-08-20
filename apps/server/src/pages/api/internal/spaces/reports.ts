// /api/internal/spaces/:spaceId/reports
//   GET  → list report definitions (each with its latest run)
//   POST → create a report definition (server-side validation + capability gate)
//
// server-reports task 3.1. apps/web proxies here; token gate is applied by
// middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { listDefinitions, createDefinition } from "../../../../lib/reports/store";
import { parseCreateDefinition } from "../../../../lib/reports/validate";
import { checkReportCreationGate } from "../../../../lib/reports/gate";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesReportsHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  const { db } = locals.getMasterDb();

  if (request.method === "GET") {
    const items = await listDefinitions(db, spaceId);
    return jsonResponse({ ok: true, definitions: items }, 200);
  }

  // POST — create.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const parsed = parseCreateDefinition(raw);
  if (!parsed.ok) {
    return jsonResponse({ error: "invalid_request", message: parsed.error }, 400);
  }

  // Capability gate (creation cap + scheduled-delivery + export), server-side.
  const gate = await checkReportCreationGate(db, env, {
    spaceId,
    wantsSchedule: parsed.value.scheduleCadence != null,
    wantsExport: true, // definitions can always be exported once generated
  });
  if (!gate.allowed) {
    return jsonResponse(
      {
        error: gate.code,
        message: gate.message,
        feature: gate.feature,
        used: gate.used,
        limit: gate.limit,
        addon: gate.addon,
      },
      403,
    );
  }

  const createdBy =
    typeof (raw as { createdBy?: unknown }).createdBy === "string"
      ? (raw as { createdBy: string }).createdBy
      : null;

  const definition = await createDefinition(db, {
    spaceId,
    createdBy,
    now: new Date(),
    ...parsed.value,
  });
  return jsonResponse({ ok: true, definition }, 201);
}
