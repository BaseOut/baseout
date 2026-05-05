// Internal ping. Token-gated by middleware (path begins /api/internal/).
// Phase 1: replace with real internal routes (enqueue backup, restore, etc.).

import type { AppLocals, Env } from "../../../env";

export async function internalPingHandler(
  _request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  _locals: AppLocals,
): Promise<Response> {
  return new Response(
    JSON.stringify({ pong: true, ts: Date.now() }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
