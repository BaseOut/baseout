// Public liveness probe. The only public route on the engine.
// Per CLAUDE.md §5.2.

import type { AppLocals, Env } from "../../env";

export async function healthHandler(
  _request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  _locals: AppLocals,
): Promise<Response> {
  return new Response(
    JSON.stringify({ ok: true, service: "baseout-server", t: Date.now() }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
