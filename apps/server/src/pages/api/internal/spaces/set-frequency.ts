// POST /api/internal/spaces/:spaceId/set-frequency
//
// Proxy route the apps/web PATCH /backup-config calls when the frequency
// changes. apps/web cannot reach the SpaceDO directly across the service
// binding; this route forwards to env.SPACE_DO and writes the resulting
// next_scheduled_at back to backup_configurations so the integrations
// view can read it on the next SSR pass.
//
// Token gate is applied by middleware (path begins /api/internal/). This
// handler validates URL shape (UUID) + body shape (frequency), then
// forwards to the DO via `env.SPACE_DO.get(idFromName(spaceId))`.
//
// Result-code → HTTP-status mapping:
//   ok                          → 200  { ok: true, nextFireMs }
//   invalid request / frequency → 400
//   DO returned non-2xx         → 502  { error: 'space_do_error', upstream_status }

import { eq } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { backupConfigurations } from "../../../../db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_SCHEDULED_FREQUENCIES = new Set(["monthly", "weekly", "daily"]);

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
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const frequency = (raw as { frequency?: unknown }).frequency;
  if (
    typeof frequency !== "string" ||
    !VALID_SCHEDULED_FREQUENCIES.has(frequency)
  ) {
    return jsonResponse({ error: "invalid_frequency" }, 400);
  }

  // Forward to the per-Space DO.
  const doId = env.SPACE_DO.idFromName(spaceId);
  const doRes = await env.SPACE_DO.get(doId).fetch(
    "http://do/set-frequency",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spaceId, frequency }),
    },
  );

  if (!doRes.ok) {
    let upstreamStatus = doRes.status;
    return jsonResponse(
      { error: "space_do_error", upstream_status: upstreamStatus },
      502,
    );
  }

  const body = (await doRes.json()) as { ok: boolean; nextFireMs: number };

  // Persist the next-fire timestamp so the IntegrationsView SSR pass can
  // surface "Next backup: <date>" without re-asking the DO. SpaceDO.alarm()
  // ALSO writes this on every alarm fire — this is the initial write.
  const { db } = locals.getMasterDb();
  await db
    .update(backupConfigurations)
    .set({ nextScheduledAt: new Date(body.nextFireMs) })
    .where(eq(backupConfigurations.spaceId, spaceId));

  return jsonResponse({ ok: true, nextFireMs: body.nextFireMs }, 200);
}
