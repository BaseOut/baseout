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
import { runsStartHandler } from "./pages/api/internal/runs/start";
import { runsCompleteHandler } from "./pages/api/internal/runs/complete";
import { runsProgressHandler } from "./pages/api/internal/runs/progress";
import { runsCancelHandler } from "./pages/api/internal/runs/cancel";
import { spacesSetFrequencyHandler } from "./pages/api/internal/spaces/set-frequency";
import { spacesRescanBasesHandler } from "./pages/api/internal/spaces/rescan-bases";
import { runOAuthRefreshTick } from "./lib/oauth-refresh";

const CONNECTIONS_WHOAMI_RE =
  /^\/api\/internal\/connections\/([^/]+)\/whoami$/;
const CONNECTIONS_DO_PROXY_RE =
  /^\/api\/internal\/connections\/([^/]+)\/(lock|unlock|token)$/;
const RUNS_START_RE = /^\/api\/internal\/runs\/([^/]+)\/start$/;
const RUNS_COMPLETE_RE = /^\/api\/internal\/runs\/([^/]+)\/complete$/;
const RUNS_PROGRESS_RE = /^\/api\/internal\/runs\/([^/]+)\/progress$/;
const RUNS_CANCEL_RE = /^\/api\/internal\/runs\/([^/]+)\/cancel$/;
const SPACES_SET_FREQUENCY_RE =
  /^\/api\/internal\/spaces\/([^/]+)\/set-frequency$/;
const SPACES_RESCAN_BASES_RE =
  /^\/api\/internal\/spaces\/([^/]+)\/rescan-bases$/;

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

      // Run-start handles its own method check so non-POST returns 405
      // (rather than 404) — gives the caller a clearer wire-error if it
      // somehow fires the wrong verb.
      const start = RUNS_START_RE.exec(url.pathname);
      if (start) {
        return await runsStartHandler(request, env, ctx, locals, start[1]!);
      }

      // Run-complete: same method-check-inside-handler pattern.
      const complete = RUNS_COMPLETE_RE.exec(url.pathname);
      if (complete) {
        return await runsCompleteHandler(
          request,
          env,
          ctx,
          locals,
          complete[1]!,
        );
      }

      // Run-progress (Phase 10d): same method-check-inside-handler pattern.
      const progress = RUNS_PROGRESS_RE.exec(url.pathname);
      if (progress) {
        return await runsProgressHandler(
          request,
          env,
          ctx,
          locals,
          progress[1]!,
        );
      }

      // Run-cancel: same method-check-inside-handler pattern. Handles 405
      // for non-POST + 400 for non-UUID runId before touching the DB.
      const cancel = RUNS_CANCEL_RE.exec(url.pathname);
      if (cancel) {
        return await runsCancelHandler(
          request,
          env,
          ctx,
          locals,
          cancel[1]!,
        );
      }

      // Spaces set-frequency proxy (Phase B of
      // baseout-backup-schedule-and-cancel). apps/web's PATCH /backup-config
      // calls this when frequency changes; the route forwards to SpaceDO
      // and writes backup_configurations.next_scheduled_at.
      const setFreq = SPACES_SET_FREQUENCY_RE.exec(url.pathname);
      if (setFreq) {
        return await spacesSetFrequencyHandler(
          request,
          env,
          ctx,
          locals,
          setFreq[1]!,
        );
      }

      // Workspace rediscovery — manual rescan. apps/web's POST
      // /api/spaces/:spaceId/rescan-bases proxies here. Method-check inside
      // handler so non-POST returns 405. Same alarm pure-fn runs in Phase 4
      // (SpaceDO) for scheduled rediscovery.
      const rescanBases = SPACES_RESCAN_BASES_RE.exec(url.pathname);
      if (rescanBases) {
        return await spacesRescanBasesHandler(
          request,
          env,
          ctx,
          locals,
          rescanBases[1]!,
        );
      }

      return notFound();
    } finally {
      // Tear down only if a handler actually built the masterDb. Avoids a
      // wasted `sql.end` cycle on health / ping which never query.
      if (slot.value) ctx.waitUntil(slot.value.sql.end({ timeout: 5 }));
    }
  },

  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    // Only one cron is wired today: `*/15 * * * *` for OAuth token refresh.
    // When additional crons activate (webhook renewal, trial-expiry, quota,
    // smart-cleanup), branch on `event.cron` to dispatch to the right job.
    if (event.cron !== "*/15 * * * *") {
      // Unknown cron — fail loud once instead of silently dropping work.
      console.error(`[scheduled] unknown cron: ${event.cron}`);
      return;
    }

    const { db, sql: pgSql } = createMasterDb(env);
    try {
      const result = await runOAuthRefreshTick({
        db,
        encryptionKey: env.BASEOUT_ENCRYPTION_KEY,
        clientId: env.AIRTABLE_OAUTH_CLIENT_ID,
        clientSecret: env.AIRTABLE_OAUTH_CLIENT_SECRET,
        log: (e) => {
          // Structured stderr — no logger lib wired in apps/server yet.
          // The per-row event is JSON so it tails cleanly with `wrangler tail`.
          // eslint-disable-next-line no-console -- intentional structured log
          console.log(JSON.stringify(e));
        },
      });
      // eslint-disable-next-line no-console -- intentional structured log
      console.log(
        JSON.stringify({
          event: "oauth_refresh_tick",
          considered: result.considered,
          claimed: result.claimed,
          ...result.outcomes,
        }),
      );
    } finally {
      ctx.waitUntil(pgSql.end({ timeout: 5 }));
    }
  },
};
