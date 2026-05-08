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
import {
  connectionDOProxyHandler,
  type ConnectionDOProxyAction,
} from "./pages/api/internal/connections/do-proxy";
import { uploadCsvHandler } from "./pages/api/internal/runs/upload-csv";
import { runsStartHandler } from "./pages/api/internal/runs/start";

const CONNECTIONS_WHOAMI_RE =
  /^\/api\/internal\/connections\/([^/]+)\/whoami$/;
const CONNECTIONS_DO_PROXY_RE =
  /^\/api\/internal\/connections\/([^/]+)\/(lock|unlock|token)$/;
const RUNS_UPLOAD_CSV_RE =
  /^\/api\/internal\/runs\/([^/]+)\/upload-csv$/;
const RUNS_START_RE = /^\/api\/internal\/runs\/([^/]+)\/start$/;

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
        const proxy = CONNECTIONS_DO_PROXY_RE.exec(url.pathname);
        if (proxy) {
          return await connectionDOProxyHandler(
            request,
            env,
            proxy[1]!,
            proxy[2]! as ConnectionDOProxyAction,
          );
        }
      }

      // Upload-csv handles its own method check so non-POST returns 405
      // (rather than 404) — gives the caller a clearer wire-error if it
      // somehow fires the wrong verb.
      const upload = RUNS_UPLOAD_CSV_RE.exec(url.pathname);
      if (upload) {
        return await uploadCsvHandler(request, env, ctx, locals, upload[1]!);
      }

      // Run-start: same method-check-inside-handler pattern as upload-csv.
      const start = RUNS_START_RE.exec(url.pathname);
      if (start) {
        return await runsStartHandler(request, env, ctx, locals, start[1]!);
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
