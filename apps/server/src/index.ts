// @baseout/server — backup/restore engine. Cloudflare Worker entry point.
// Headless API only: /api/health (public) + /api/internal/* (INTERNAL_TOKEN-gated).
// Per CLAUDE.md §5.2.

import type { Env } from "./env";
import { applyMiddleware } from "./middleware";
import { healthHandler } from "./pages/api/health";
import { internalPingHandler } from "./pages/api/internal/ping";

// Re-export Durable Object classes so workerd can resolve their bindings.
// Required even when Astro adapter wraps the entry — see CLAUDE.md §5.1.
export { ConnectionDO } from "./durable-objects/ConnectionDO";
export { SpaceDO } from "./durable-objects/SpaceDO";

function notFound(): Response {
  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const mw = applyMiddleware(request, env, ctx);
    if (mw.res) return mw.res;

    if (url.pathname === "/api/health") {
      return healthHandler(request, env, ctx, mw.locals);
    }
    if (url.pathname === "/api/internal/ping") {
      return internalPingHandler(request, env, ctx, mw.locals);
    }

    // PoC-only DO smoke test: forwards to ConnectionDO by stable name.
    // Token-gated via the /api/internal/ prefix in middleware.
    if (url.pathname === "/api/internal/__do-smoke") {
      const id = env.CONNECTION_DO.idFromName("smoke-test");
      return env.CONNECTION_DO.get(id).fetch(request);
    }

    return notFound();
  },

  async scheduled(
    _event: ScheduledEvent,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    // TODO(phase-2): cron-trigger dispatch (webhook renewal, OAuth refresh, etc.)
  },
};
