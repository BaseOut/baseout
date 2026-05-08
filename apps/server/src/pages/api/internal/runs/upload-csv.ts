// POST /api/internal/runs/:runId/upload-csv
//
// The Trigger.dev backup-base task runs in Node and cannot reach the
// BACKUP_BUCKET R2 binding directly (bindings are workerd-only). This
// route is the proxy: the task POSTs CSV bytes here, the Worker writes
// to R2 via the binding. INTERNAL_TOKEN gate is applied by middleware.
//
// Request body:
//   { key: string, contentType: string, body: string }
//
// Response:
//   200  { ok: true, key, size }
//   400  { error: 'invalid_json' | 'invalid_request' }
//   405  { error: 'method_not_allowed' }
//
// The `runId` in the URL is currently used only for logging/audit context;
// future iterations will check it against the masterDb to ensure the run
// is still active before accepting writes (Phase 8). For MVP we trust the
// token-gated caller and validate URL shape only.

import type { AppLocals, Env } from "../../../../env";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface UploadBody {
  key?: unknown;
  contentType?: unknown;
  body?: unknown;
}

export async function uploadCsvHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  _locals: AppLocals,
  runId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!UUID_RE.test(runId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  let parsed: UploadBody;
  try {
    parsed = (await request.json()) as UploadBody;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const key = typeof parsed.key === "string" ? parsed.key : "";
  const contentType =
    typeof parsed.contentType === "string" ? parsed.contentType : "";
  const body = typeof parsed.body === "string" ? parsed.body : null;

  if (!key || !contentType || body === null) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  // Path-traversal guard. R2 keys are opaque strings — `..` segments don't
  // actually escape a bucket — but we still reject them so the on-disk
  // representation is unambiguous and audit-friendly.
  if (key.includes("..")) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  await env.BACKUP_BUCKET.put(key, body, {
    httpMetadata: { contentType },
  });

  return jsonResponse({ ok: true, key, size: body.length }, 200);
}
