// GET /api/internal/connections/token-health
//
// Stale-token gauge (server-oauth-refresh-cron-health + shared-oauth-refresh-keepalive).
// Returns two counts, both of which should read ~0 when the active refresh model
// is healthy — a persistent non-zero value means the clock/sweep/keep-alive is
// broken (the 2026-07-14 failure mode: a token sat expired 4.7 days, zero signal):
//   - activeExpired      — `active` Airtable connections whose ACCESS token is
//                          already past expiry. The signal for 'sweep'/'shadow'
//                          mode (the */15 sweep keeps access tokens fresh).
//   - refreshExpiringSoon — `active` Airtable connections whose REFRESH token is
//                          within REFRESH_ALERT_WINDOW of its 60-day idle-expiry.
//                          The signal for 'keepalive' mode (the daily job keeps
//                          refresh tokens alive). NULL expiry is excluded — it is
//                          "not yet populated", not "near expiry".
// Both are returned in every mode so cutover doesn't blind either signal.
//
// Token gate is applied by middleware (path begins /api/internal/).

import { and, eq, lt, isNotNull } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { connections, platforms } from "../../../../db/schema";

// Alert if a refresh token is within 3 days of idle-expiry — well inside the
// 15-day keep-alive lookahead, so after a keep-alive pass this is ~0; a non-zero
// value means keep-alive is falling behind.
const REFRESH_ALERT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

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

  const db = locals.getMasterDb().db;

  const accessExpiredRows = await db
    .select({ id: connections.id })
    .from(connections)
    .innerJoin(platforms, eq(platforms.id, connections.platformId))
    .where(
      and(
        eq(platforms.slug, "airtable"),
        eq(connections.status, "active"),
        lt(connections.tokenExpiresAt, new Date()),
      ),
    );

  const refreshExpiringRows = await db
    .select({ id: connections.id })
    .from(connections)
    .innerJoin(platforms, eq(platforms.id, connections.platformId))
    .where(
      and(
        eq(platforms.slug, "airtable"),
        eq(connections.status, "active"),
        isNotNull(connections.refreshTokenExpiresAt),
        lt(
          connections.refreshTokenExpiresAt,
          new Date(Date.now() + REFRESH_ALERT_WINDOW_MS),
        ),
      ),
    );

  return new Response(
    JSON.stringify({
      activeExpired: accessExpiredRows.length,
      refreshExpiringSoon: refreshExpiringRows.length,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
