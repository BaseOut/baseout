// PoC route — confirms the Worker → Trigger.dev wire works end-to-end.
// Enqueues the _ping task and returns the resulting run ID. Token-gated
// by /api/internal/* in middleware. Real backup-task enqueue lives in
// runs/start.ts (Phase 8); this is a long-term liveness probe for the
// SDK config + project-ref wiring.

import { enqueuePing } from "../../../lib/trigger-client";
import type { AppLocals, Env } from "../../../env";

export async function triggerSmokeHandler(
  _request: Request,
  env: Env,
  _ctx: ExecutionContext,
  _locals: AppLocals,
): Promise<Response> {
  try {
    const handle = await enqueuePing(env, { echo: "trigger-smoke" });
    return new Response(
      JSON.stringify({ runId: handle.id }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "trigger_failed", detail: message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
