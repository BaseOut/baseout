// POST /api/internal/spaces/:spaceId/set-frequency
//
// Proxy route the apps/web PATCH /backup-config calls when the schedule/scope
// changes. apps/web cannot reach the SpaceDO directly across the service
// binding; this route forwards to env.SPACE_DO and writes the resulting
// next_scheduled_at + schema_next_scheduled_at back to backup_configurations
// so the integrations view can read them on the next SSR pass.
//
// server-backup-scope: the body is now scope-aware —
// { scope, dataFrequency?, schemaFrequency? } — with the legacy { frequency }
// shape still accepted (treated as a schema_and_data data schedule). Validation
// + normalization is the shared `parseScheduleBody` so the route 400s on a bad
// body without touching the DO/DB.
//
// Token gate is applied by middleware (path begins /api/internal/).
//
// Result-code → HTTP-status mapping:
//   ok                    → 200  { ok, dataNextFire, schemaNextFire }
//   invalid request/body  → 400
//   DO returned non-2xx   → 502  { error: 'space_do_error', upstream_status }

import { eq } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { backupConfigurations } from "../../../../db/schema";
import { parseScheduleBody } from "../../../../lib/scheduling/dual-schedule";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesSetFrequencyHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(spaceId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const parsed = parseScheduleBody(raw);
  if (!parsed) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  // Forward the normalized schedule to the per-Space DO.
  const doId = env.SPACE_DO.idFromName(spaceId);
  const doRes = await env.SPACE_DO.get(doId).fetch("http://do/set-frequency", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ spaceId, ...parsed }),
  });

  if (!doRes.ok) {
    return jsonResponse(
      { error: "space_do_error", upstream_status: doRes.status },
      502,
    );
  }

  const body = (await doRes.json()) as {
    ok: boolean;
    dataNextFire: number | null;
    schemaNextFire: number | null;
  };

  // Persist both next-fire timestamps so the SSR pass can surface "Next data
  // backup" / "Next schema backup" without re-asking the DO. SpaceDO.alarm()
  // also writes these on every alarm fire — this is the initial write.
  const { db } = locals.getMasterDb();
  await db
    .update(backupConfigurations)
    .set({
      nextScheduledAt:
        body.dataNextFire != null ? new Date(body.dataNextFire) : null,
      schemaNextScheduledAt:
        body.schemaNextFire != null ? new Date(body.schemaNextFire) : null,
    })
    .where(eq(backupConfigurations.spaceId, spaceId));

  return jsonResponse(
    { ok: true, dataNextFire: body.dataNextFire, schemaNextFire: body.schemaNextFire },
    200,
  );
}
