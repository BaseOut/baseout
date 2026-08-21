// /api/internal/spaces/:spaceId/reports/:defId
//   GET    → the definition + its run history
//   PATCH  → update the definition (full-body replace of editable fields)
//   DELETE → delete the definition (rejects the default report)
//
// server-reports task 3.1.

import type { AppLocals, Env } from "../../../../env";
import {
  getDefinition,
  listRunsForDefinition,
  updateDefinition,
  deleteDefinition,
} from "../../../../lib/reports/store";
import { parseCreateDefinition } from "../../../../lib/reports/validate";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesReportHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  defId: string,
): Promise<Response> {
  const method = request.method;
  if (method !== "GET" && method !== "PATCH" && method !== "DELETE") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(spaceId) || !UUID_RE.test(defId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();

  if (method === "GET") {
    const definition = await getDefinition(db, spaceId, defId);
    if (!definition) return jsonResponse({ error: "not_found" }, 404);
    const runs = await listRunsForDefinition(db, spaceId, defId);
    return jsonResponse({ ok: true, definition, runs }, 200);
  }

  if (method === "PATCH") {
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
    const updated = await updateDefinition(db, spaceId, defId, parsed.value, new Date());
    if (!updated) return jsonResponse({ error: "not_found" }, 404);
    return jsonResponse({ ok: true, definition: updated }, 200);
  }

  // DELETE
  const result = await deleteDefinition(db, spaceId, defId);
  if (result === "not_found") return jsonResponse({ error: "not_found" }, 404);
  if (result === "is_default") {
    return jsonResponse({ error: "default_report_protected" }, 403);
  }
  return jsonResponse({ ok: true }, 200);
}
