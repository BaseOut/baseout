// @baseout/api — public read-only REST API at api.baseout.com (api-rest-read).
//
// Request pipeline: version check → authenticate (Bearer → api_tokens) →
// route (operation registry) → shadow rate limit → validate → handler. Every
// response carries X-Request-Id + X-RateLimit-* (authenticated); every request
// is metered to Analytics Engine (fire-and-forget). Master DB read in-Worker;
// per-Space schema via the SERVER service binding only (design D3).

import { createMasterDb, type ApiDb } from "./db/client";
import { authenticate, touchLastUsed } from "./lib/auth";
import { ApiError, errorResponse, notFound, unauthorized } from "./lib/errors";
import { log } from "./lib/log";
import { meterRequest, type UsagePoint } from "./lib/metering";
import { evaluateRateLimit } from "./lib/ratelimit";
import { buildRouter, type OperationContext } from "./lib/registry";
import { operations } from "./operations";
import { handleMcp } from "./mcp/transport";
import type { Env } from "./env";
import type { Sql } from "postgres";

const router = buildRouter(operations);

function withHeaders(res: Response, extra: Record<string, string>): Response {
  if (!Object.keys(extra).length) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = crypto.randomUUID();
    const now = new Date();
    const started = Date.now();
    const url = new URL(request.url);

    const meter = (usage: Partial<UsagePoint> & { status: number }) =>
      meterRequest(env, {
        tokenId: null, orgId: null, spaceId: null, platform: null,
        routeTemplate: url.pathname, method: request.method, surface: "rest",
        durationMs: Date.now() - started,
        ...usage,
      });

    // MCP server (api-mcp) — mounted at /mcp on the same Worker, auth-first
    // (reject before the handshake, §2.2), tools generated from the REST registry
    // and executed in-process. Handled before the /v1 REST gate.
    if (url.pathname === "/mcp") {
      let mcpSql: Sql | null = null;
      try {
        const conn = createMasterDb(env);
        mcpSql = conn.sql;
        const grant = await authenticate(conn.db, request.headers.get("authorization"), now);
        if (!grant) {
          const res = errorResponse(unauthorized(), requestId);
          meter({ surface: "mcp", routeTemplate: "/mcp", status: 401 });
          return res;
        }
        ctx.waitUntil(touchLastUsed(conn.db, grant.id, now).catch(() => {}));
        const rl = await evaluateRateLimit(env, grant.id);
        if (rl.block) {
          meter({ surface: "mcp", routeTemplate: "/mcp", tokenId: grant.id, orgId: grant.organizationId, status: 429 });
          return errorResponse(new ApiError("rate_limited", "rate_limited", "Rate limit exceeded.", { headers: rl.headers }), requestId, rl.headers);
        }
        const { res, label } = await handleMcp(request, { operations, db: conn.db, sql: conn.sql, env, ctx, grant, now, requestId }, requestId);
        meter({ surface: "mcp", routeTemplate: label, tokenId: grant.id, orgId: grant.organizationId, status: res.status });
        return withHeaders(res, rl.headers);
      } catch (err) {
        if (!(err instanceof ApiError)) log.error("api.mcp.unhandled", { requestId, err: err instanceof Error ? err.message : String(err) });
        meter({ surface: "mcp", routeTemplate: "/mcp", status: 500 });
        return errorResponse(err, requestId);
      } finally {
        if (mcpSql) ctx.waitUntil(mcpSql.end({ timeout: 5 }).catch(() => {}));
      }
    }

    // Version gate — before any DB work.
    if (!url.pathname.startsWith("/v1/")) {
      const err = /^\/v\d+\//.test(url.pathname)
        ? notFound("version_not_found", "Unknown API version.")
        : notFound("not_found", "Not found.");
      const res = errorResponse(err, requestId);
      meter({ status: res.status });
      return res;
    }

    let sql: Sql | null = null;
    try {
      const conn = createMasterDb(env);
      sql = conn.sql;
      const db: ApiDb = conn.db;

      const grant = await authenticate(db, request.headers.get("authorization"), now);
      if (!grant) {
        const res = errorResponse(unauthorized(), requestId);
        meter({ status: 401 });
        return res;
      }
      ctx.waitUntil(touchLastUsed(db, grant.id, now).catch(() => {}));

      const matched = router.match(request.method, url.pathname);
      if (!matched) {
        const err = router.pathExists(url.pathname)
          ? new ApiError("invalid_request", "method_not_allowed", "Method not allowed.", { status: 405 })
          : notFound("not_found", "Not found.");
        const res = errorResponse(err, requestId);
        meter({ tokenId: grant.id, orgId: grant.organizationId, status: res.status });
        return res;
      }
      const { op, params } = matched;

      const rl = await evaluateRateLimit(env, grant.id);
      if (rl.block) {
        const res = errorResponse(
          new ApiError("rate_limited", "rate_limited", "Rate limit exceeded.", { headers: rl.headers }),
          requestId,
          rl.headers,
        );
        meter({ tokenId: grant.id, orgId: grant.organizationId, routeTemplate: op.path, status: 429 });
        return res;
      }

      let body: unknown;
      if (op.method === "POST") body = await request.json().catch(() => ({}));

      const c: OperationContext = {
        db, sql, env, ctx, grant, params,
        query: url.searchParams, body, requestId, headers: request.headers, now,
      };
      const res = withHeaders(await op.handler(c), rl.headers);
      meter({
        tokenId: grant.id, orgId: grant.organizationId, spaceId: params.spaceId ?? null,
        platform: params.platform ?? null, routeTemplate: op.path, status: res.status,
      });
      return res;
    } catch (err) {
      if (!(err instanceof ApiError)) {
        log.error("api.unhandled", { requestId, err: err instanceof Error ? err.message : String(err) });
      }
      const res = errorResponse(err, requestId);
      meter({ status: res.status });
      return res;
    } finally {
      if (sql) ctx.waitUntil(sql.end({ timeout: 5 }).catch(() => {}));
    }
  },
};
