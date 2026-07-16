// Production wiring for the OAuth refresh cron jobs
// (server-oauth-refresh-cron-health + shared-oauth-refresh-keepalive).
//
// Two scheduled jobs share the same refresh primitive (drive a Connection
// through the ConnectionDO on-demand /token path — the production
// claim/refresh/persist flow — discarding the returned token):
//
//   runScheduledOauthRefresh  (*/15)   — the legacy access-token sweep: selects
//     connections whose ACCESS token is at/near expiry. Active in 'sweep' and
//     'shadow' modes; inert in 'keepalive' (the daily job owns refresh then).
//
//   runScheduledKeepalive     (0 13)   — the idle keep-alive: selects
//     connections whose REFRESH token approaches its 60-day idle-expiry. In
//     'keepalive' it refreshes; in 'shadow' it logs what it WOULD refresh (no
//     writes) for pre-cutover comparison; in 'sweep' it no-ops.
//
// scheduled() has no request-scoped locals, so the master DB client is created
// and torn down per firing (CLAUDE.md §5.1).

import { and, eq, isNotNull, lte, or, isNull, asc, sql, inArray } from "drizzle-orm";
import { createMasterDb } from "../../db/worker";
import { connections, platforms } from "../../db/schema";
import { REFRESH_LOOKAHEAD_MS } from "../connections/resolve-airtable-token";
import { runConnectionAutoInvalidate } from "../connections/auto-invalidate";
import {
  runOauthRefreshSweep,
  type OauthRefreshSweepResult,
  type RefreshSweepOutcome,
} from "./oauth-refresh-sweep";
import {
  resolveKeepaliveMode,
  sweepRefreshesInMode,
  keepaliveRefreshesInMode,
  keepaliveShadowsInMode,
} from "./keepalive-mode";
import type { Env } from "../../env";

// Refresh a connection whose refresh token expires within this window, so the
// idle-expiry (~60 days) never lapses. 15 days of margin → each idle connection
// is refreshed at ~day 45, well before Airtable revokes at day 60.
const KEEPALIVE_LOOKAHEAD_MS = 15 * 24 * 60 * 60 * 1000;
const KEEPALIVE_MAX_PER_FIRING = 25;

type MasterDb = ReturnType<typeof createMasterDb>["db"];

function logEvent(event: Record<string, unknown>): void {
  // eslint-disable-next-line no-console -- per-firing summary is the cron observability contract; a silently inert/behind job is the failure mode these jobs exist to kill
  console.log(JSON.stringify(event));
}

/** Drive one Connection through the ConnectionDO /token path (refresh side effect). */
async function refreshConnectionViaDO(
  env: Env,
  connectionId: string,
): Promise<RefreshSweepOutcome> {
  const stub = env.CONNECTION_DO.get(env.CONNECTION_DO.idFromName(connectionId));
  const res = await stub.fetch("http://do/token", {
    method: "POST",
    body: JSON.stringify({ connectionId }),
    headers: { "content-type": "application/json" },
  });
  // Token in the body is deliberately discarded — the refresh side effect
  // (persisted rotated tokens) is the point.
  await res.body?.cancel?.();
  if (res.status === 200) return "refreshed";
  if (res.status === 409) return "pending_reauth";
  return "failed";
}

/** Active Airtable connections whose refresh token nears its idle-expiry. */
function listKeepaliveConnections(db: MasterDb, limit: number) {
  const staleBefore = new Date(Date.now() + KEEPALIVE_LOOKAHEAD_MS);
  return db
    .select({ id: connections.id })
    .from(connections)
    .innerJoin(platforms, eq(platforms.id, connections.platformId))
    .where(
      and(
        eq(platforms.slug, "airtable"),
        eq(connections.status, "active"),
        isNotNull(connections.refreshTokenEnc),
        // NULL = never-populated legacy row → eligible so it self-populates on
        // first keep-alive (bounded by the per-firing cap, so no stampede).
        or(
          isNull(connections.refreshTokenExpiresAt),
          lte(connections.refreshTokenExpiresAt, staleBefore),
        ),
      ),
    )
    .orderBy(
      sql`${connections.refreshTokenExpiresAt} asc nulls first`,
      asc(connections.id),
    )
    .limit(limit);
}

export async function runScheduledOauthRefresh(
  env: Env,
): Promise<OauthRefreshSweepResult | null> {
  const mode = resolveKeepaliveMode(env.AIRTABLE_KEEPALIVE_MODE);
  // In 'keepalive' the daily job owns refresh — the sweep would double-refresh
  // (and burn the same rotation twice), so it stands down.
  if (!sweepRefreshesInMode(mode)) {
    logEvent({ event: "oauth_refresh_sweep", skipped: "keepalive_mode", mode });
    return null;
  }
  // The DO's /token route only refreshes when on-demand refresh is enabled;
  // without the flag the sweep would no-op silently — log loudly instead.
  if (env.AIRTABLE_ON_DEMAND_REFRESH_ENABLED !== "1") {
    logEvent({
      event: "oauth_refresh_sweep",
      skipped: "on_demand_refresh_disabled",
    });
    return null;
  }

  const { db, sql: pg } = createMasterDb(env);
  try {
    return await runOauthRefreshSweep({
      listStaleConnections: async (limit) => {
        const staleBefore = new Date(Date.now() + REFRESH_LOOKAHEAD_MS);
        return db
          .select({ id: connections.id })
          .from(connections)
          .innerJoin(platforms, eq(platforms.id, connections.platformId))
          .where(
            and(
              eq(platforms.slug, "airtable"),
              eq(connections.status, "active"),
              isNotNull(connections.refreshTokenEnc),
              or(
                isNull(connections.tokenExpiresAt),
                lte(connections.tokenExpiresAt, staleBefore),
              ),
            ),
          )
          .orderBy(
            sql`${connections.tokenExpiresAt} asc nulls first`,
            asc(connections.id),
          )
          .limit(limit);
      },
      refreshConnection: (connectionId) =>
        refreshConnectionViaDO(env, connectionId),
      log: logEvent,
    });
  } finally {
    await pg.end({ timeout: 5 }).catch(() => {});
  }
}

export async function runScheduledKeepalive(
  env: Env,
): Promise<OauthRefreshSweepResult | null> {
  const mode = resolveKeepaliveMode(env.AIRTABLE_KEEPALIVE_MODE);

  // 'sweep' (default): keep-alive is inert — the */15 sweep is authoritative.
  if (!keepaliveRefreshesInMode(mode) && !keepaliveShadowsInMode(mode)) {
    logEvent({ event: "oauth_keepalive", skipped: "sweep_mode", mode });
    return null;
  }

  const { db, sql: pg } = createMasterDb(env);
  try {
    // 'shadow': run the selection and log what we WOULD refresh — no writes —
    // so counts can be compared against the live sweep before cutover.
    if (keepaliveShadowsInMode(mode)) {
      const rows = await listKeepaliveConnections(db, KEEPALIVE_MAX_PER_FIRING + 1);
      const truncated = rows.length > KEEPALIVE_MAX_PER_FIRING;
      logEvent({
        event: "oauth_keepalive",
        mode: "shadow",
        wouldRefresh: Math.min(rows.length, KEEPALIVE_MAX_PER_FIRING),
        truncated,
      });
      return null;
    }

    // 'keepalive': refresh idle-expiring connections through the DO gate.
    if (env.AIRTABLE_ON_DEMAND_REFRESH_ENABLED !== "1") {
      logEvent({
        event: "oauth_keepalive",
        skipped: "on_demand_refresh_disabled",
        mode,
      });
      return null;
    }
    return await runOauthRefreshSweep({
      maxPerSweep: KEEPALIVE_MAX_PER_FIRING,
      listStaleConnections: async (limit) => listKeepaliveConnections(db, limit),
      refreshConnection: (connectionId) =>
        refreshConnectionViaDO(env, connectionId),
      log: (event) => logEvent({ ...event, event: "oauth_keepalive", mode }),
    });
  } finally {
    await pg.end({ timeout: 5 }).catch(() => {});
  }
}

// Dead-connection auto-invalidation (Phase 4): flip Airtable connections stuck
// in 'pending_reauth' past the ~10-day grace window to 'invalid'. Runs on the
// daily keep-alive cron. Independent of AIRTABLE_KEEPALIVE_MODE — the grace
// clock (pending_reauth_at) advances regardless of which refresh model is live.
export async function runScheduledConnectionInvalidation(
  env: Env,
): Promise<{ invalidated: number } | null> {
  const { db, sql: pg } = createMasterDb(env);
  try {
    return await runConnectionAutoInvalidate({
      now: () => new Date(),
      invalidateStale: async (cutoff) => {
        const airtablePlatforms = db
          .select({ id: platforms.id })
          .from(platforms)
          .where(eq(platforms.slug, "airtable"));
        const rows = await db
          .update(connections)
          .set({
            status: "invalid",
            invalidatedAt: new Date(),
            modifiedAt: new Date(),
          })
          .where(
            and(
              eq(connections.status, "pending_reauth"),
              isNotNull(connections.pendingReauthAt),
              lte(connections.pendingReauthAt, cutoff),
              inArray(connections.platformId, airtablePlatforms),
            ),
          )
          .returning({ id: connections.id });
        return rows.length;
      },
      log: logEvent,
    });
  } finally {
    await pg.end({ timeout: 5 }).catch(() => {});
  }
}
