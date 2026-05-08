// @baseout/server — backup/restore engine. Cloudflare Worker entry point.
// Headless API only: /api/health (public) + /api/internal/* (INTERNAL_TOKEN-gated).
// Per CLAUDE.md §5.2.

import type { AppLocals, Env } from "./env";
import { createMasterDb } from "./db/worker";
import { applyMiddleware } from "./middleware";
import { healthHandler } from "./pages/api/health";
import { internalPingHandler } from "./pages/api/internal/ping";
import { dbSmokeHandler } from "./pages/api/internal/db-smoke";
import { triggerSmokeHandler } from "./pages/api/internal/trigger-smoke";
import { whoamiHandler } from "./pages/api/internal/connections/whoami";

const CONNECTIONS_WHOAMI_RE =
  /^\/api\/internal\/connections\/([^/]+)\/whoami$/;

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
    const mw = applyMiddleware(request, env);
    if (mw.res) return mw.res;

    // Per CLAUDE.md §5.1: per-request masterDb. Built lazily on first access
    // so handlers that don't need the DB (health, ping) don't pay for it
    // and don't crash when DATABASE_URL/HYPERDRIVE is misconfigured.
    // Wrapped in an object so closure reassignment survives TS narrowing.
    const slot: { value: ReturnType<typeof createMasterDb> | null } = {
      value: null,
    };
    const locals: AppLocals = {
      getMasterDb() {
        if (!slot.value) slot.value = createMasterDb(env);
        return slot.value;
      },
    };

    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/health") {
        return await healthHandler(request, env, ctx, locals);
      }
      if (url.pathname === "/api/internal/ping") {
        return await internalPingHandler(request, env, ctx, locals);
      }
      if (url.pathname === "/api/internal/__db-smoke") {
        return await dbSmokeHandler(request, env, ctx, locals);
      }
      if (url.pathname === "/api/internal/__trigger-smoke") {
        return await triggerSmokeHandler(request, env, ctx, locals);
      }

      // PoC-only DO smoke test: forwards to ConnectionDO by stable name.
      // Token-gated via the /api/internal/ prefix in middleware.
      if (url.pathname === "/api/internal/__do-smoke") {
        const id = env.CONNECTION_DO.idFromName("smoke-test");
        return await env.CONNECTION_DO.get(id).fetch(request);
      }

      if (request.method === "POST") {
        const m = CONNECTIONS_WHOAMI_RE.exec(url.pathname);
        if (m) {
          return await whoamiHandler(request, env, ctx, locals, m[1]!);
        }
      }

      return notFound();
    } finally {
      // Tear down only if a handler actually built the masterDb. Avoids a
      // wasted `sql.end` cycle on health / ping which never query.
      if (slot.value) ctx.waitUntil(slot.value.sql.end({ timeout: 5 }));
    }
  },

  async scheduled(
    _event: ScheduledEvent,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    // TODO(phase-2): cron-trigger dispatch (webhook renewal, OAuth refresh, etc.)
  },
};
