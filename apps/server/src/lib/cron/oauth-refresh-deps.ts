// Production wiring for the OAuth refresh sweep (server-oauth-refresh-cron-health).
//
// The pure sweep lives in ./oauth-refresh-sweep.ts; this module supplies the
// real deps: a drizzle selection whose window matches resolve-airtable-token's
// shouldRefresh() EXACTLY (design Decision 3), and a per-connection refresh
// that drives the ConnectionDO on-demand /token path — the production
// claim/refresh/persist flow — discarding the returned token (Decision 2).
// scheduled() has no request-scoped locals, so the master DB client is
// created and torn down here per firing (CLAUDE.md §5.1).

import { and, eq, isNotNull, lte, or, isNull, asc, sql } from "drizzle-orm";
import { createMasterDb } from "../../db/worker";
import { connections, platforms } from "../../db/schema";
import { REFRESH_LOOKAHEAD_MS } from "../connections/resolve-airtable-token";
import {
  runOauthRefreshSweep,
  type OauthRefreshSweepResult,
  type RefreshSweepOutcome,
} from "./oauth-refresh-sweep";
import type { Env } from "../../env";

export async function runScheduledOauthRefresh(
  env: Env,
): Promise<OauthRefreshSweepResult | null> {
  // The DO's /token route only refreshes when on-demand refresh is enabled;
  // without the flag the sweep would no-op silently — log loudly instead.
  if (env.AIRTABLE_ON_DEMAND_REFRESH_ENABLED !== "1") {
    // eslint-disable-next-line no-console -- cron observability; a silently inert sweep is the failure mode this change exists to kill
    console.log(
      JSON.stringify({ event: "oauth_refresh_sweep", skipped: "on_demand_refresh_disabled" }),
    );
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
          .orderBy(sql`${connections.tokenExpiresAt} asc nulls first`, asc(connections.id))
          .limit(limit);
      },
      refreshConnection: async (connectionId): Promise<RefreshSweepOutcome> => {
        const stub = env.CONNECTION_DO.get(env.CONNECTION_DO.idFromName(connectionId));
        const res = await stub.fetch("http://do/token", {
          method: "POST",
          body: JSON.stringify({ connectionId }),
          headers: { "content-type": "application/json" },
        });
        // Token in the body is deliberately discarded — the refresh side
        // effect (persisted rotated tokens) is the point.
        await res.body?.cancel?.();
        if (res.status === 200) return "refreshed";
        if (res.status === 409) return "pending_reauth";
        return "failed";
      },
      log: (event) => {
        // eslint-disable-next-line no-console -- per-sweep summary is the observability contract (change spec "Reconciliation is observable" analogue)
        console.log(JSON.stringify(event));
      },
    });
  } finally {
    await pg.end({ timeout: 5 }).catch(() => {});
  }
}
