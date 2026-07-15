// GET /api/internal/connections/token-health
//
// Stale-token gauge (server-oauth-refresh-cron-health, design Decision 6):
// counts `active` Airtable connections whose token_expires_at is already in
// the past. After a full sweep cycle this should read 0 — a persistent
// non-zero value means the refresh clock or sweep is broken (the 2026-07-14
// failure mode: a token sat expired 4.7 days with zero signal).
//
// Token gate is applied by middleware (path begins /api/internal/).

import { and, eq, lt } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { connections, platforms } from "../../../../db/schema";

export async function connectionsTokenHealthHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const rows = await locals
    .getMasterDb()
    .db.select({ id: connections.id })
    .from(connections)
    .innerJoin(platforms, eq(platforms.id, connections.platformId))
    .where(
      and(
        eq(platforms.slug, "airtable"),
        eq(connections.status, "active"),
        lt(connections.tokenExpiresAt, new Date()),
      ),
    );

  return new Response(JSON.stringify({ activeExpired: rows.length }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
