// GET /api/internal/connections/:connectionId/workspaces
//
// The engine's MCP workspace listing (server-mcp-workspaces): resolves the
// Connection's token through the ConnectionDO /token gate, calls the MCP
// `list_workspaces` tool, and returns the normalized list. Web proxies this
// over the BACKUP_ENGINE service binding for the picker's workspace grouping;
// the run-start auto-enroll check calls the fetch layer directly (cache
// BYPASSED — correctness path).
//
// Short-TTL in-memory cache (~60s per connection, design Decision 4): the
// picker path is interactive and workspaces change rarely; a per-isolate Map
// is acceptable staleness. Failures return HTTP 200 with
// `{ ok:false, degraded:true, reason }` — the caller's documented "grouping
// unavailable" state, NOT an error page. ⚠ On the current OAuth grant every
// MCP call 403s (`workspacesAndBases:read` missing — spike 2026-07-27,
// Features §17 Q20), so `degraded (auth)` is today's steady state; the route
// lights up when the scope decision lands and connections re-consent.
//
// Token gate is applied by middleware (path begins /api/internal/).

import { eq } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import type { AppDb } from "../../../../db/worker";
import { connections } from "../../../../db/schema";
import { fetchWorkspaces, type FetchWorkspacesResult } from "../../../../lib/mcp/mcp-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  at: number;
  result: FetchWorkspacesResult;
}
const cache = new Map<string, CacheEntry>();

/** Test seam — clears the per-isolate listing cache. */
export function clearWorkspaceListingCache(): void {
  cache.clear();
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const degraded = (reason: string) => json({ ok: false, degraded: true, reason }, 200);

/**
 * Resolve the Connection's access token via the ConnectionDO gate and call the
 * MCP workspace listing. Shared by the route (cached) and the run-start
 * auto-enroll check (cache-bypassed). Never throws.
 */
export async function fetchConnectionWorkspaces(
  env: Env,
  db: AppDb,
  connectionId: string,
): Promise<FetchWorkspacesResult | { ok: false; reason: "connection_not_found" | "connection_status" | "token_unavailable" }> {
  const rows = await db
    .select({
      status: connections.status,
      accessTokenEnc: connections.accessTokenEnc,
    })
    .from(connections)
    .where(eq(connections.id, connectionId))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, reason: "connection_not_found" };
  if (row.status !== "active") return { ok: false, reason: "connection_status" };

  const stub = env.CONNECTION_DO.get(env.CONNECTION_DO.idFromName(connectionId));
  const tokenRes = await stub.fetch("http://do/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ connectionId, encryptedToken: row.accessTokenEnc }),
  });
  if (tokenRes.status !== 200) {
    await tokenRes.body?.cancel?.();
    return { ok: false, reason: "token_unavailable" };
  }
  const { accessToken } = (await tokenRes.json()) as { accessToken: string };
  return fetchWorkspaces({ accessToken });
}

export async function connectionsWorkspacesHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  connectionId: string,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(connectionId)) return json({ error: "invalid_connection_id" }, 400);

  const cached = cache.get(connectionId);
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) {
    const r = cached.result;
    return r.ok
      ? json({ ok: true, workspaces: r.workspaces, capturedAt: r.capturedAt, cached: true }, 200)
      : degraded(r.reason);
  }

  try {
    const result = await fetchConnectionWorkspaces(env, locals.getMasterDb().db, connectionId);
    if (result.ok) {
      cache.set(connectionId, { at: now, result });
      return json({ ok: true, workspaces: result.workspaces, capturedAt: result.capturedAt }, 200);
    }
    // Cache MCP-level failures too (a 403 per picker keystroke helps nobody);
    // resolution failures (missing row / dead token) are not cached.
    if (result.reason === "connection_not_found") return json({ error: "connection_not_found" }, 404);
    if (result.reason === "connection_status" || result.reason === "token_unavailable") {
      return degraded(result.reason);
    }
    cache.set(connectionId, { at: now, result: result as FetchWorkspacesResult });
    return degraded(result.reason);
  } catch (err) {
    return degraded(err instanceof Error ? err.message : "unexpected");
  }
}
