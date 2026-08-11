// Proactive OAuth refresh sweep — PURE orchestration, deps injected
// (server-oauth-refresh-cron-health).
//
// Fired by the */15 cron. Selects active Airtable connections whose token is
// expired or expiring within the resolver's lookahead, then drives EACH
// through the ConnectionDO on-demand /token path (design Decision 2) — the
// battle-tested claim/refresh/persist flow — discarding the returned token.
// Sequential + capped per firing to bound dev-PG and DO pressure; overflow is
// logged (`truncated: true`, no silent caps) and the next firing continues.
// One bad connection never aborts the sweep.

export type RefreshSweepOutcome = "refreshed" | "pending_reauth" | "failed";

export interface OauthRefreshSweepDeps {
  /** Active Airtable connections needing refresh, oldest expiry first. */
  listStaleConnections: (limit: number) => Promise<{ id: string }[]>;
  /** Drive one connection through the DO /token on-demand path. */
  refreshConnection: (connectionId: string) => Promise<RefreshSweepOutcome>;
  log: (event: Record<string, unknown>) => void;
  /** Default 25 — bounds wall-clock + connection pressure per firing. */
  maxPerSweep?: number;
}

export interface OauthRefreshSweepResult {
  scanned: number;
  refreshed: number;
  pendingReauth: number;
  failed: number;
  truncated: boolean;
}

const DEFAULT_MAX_PER_SWEEP = 25;

export async function runOauthRefreshSweep(
  deps: OauthRefreshSweepDeps,
): Promise<OauthRefreshSweepResult> {
  const max = deps.maxPerSweep ?? DEFAULT_MAX_PER_SWEEP;
  // Fetch one extra row purely to detect overflow.
  const rows = await deps.listStaleConnections(max + 1);
  const truncated = rows.length > max;
  const batch = truncated ? rows.slice(0, max) : rows;

  let refreshed = 0;
  let pendingReauth = 0;
  let failed = 0;
  for (const { id } of batch) {
    try {
      const outcome = await deps.refreshConnection(id);
      if (outcome === "refreshed") refreshed += 1;
      else if (outcome === "pending_reauth") pendingReauth += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  const result: OauthRefreshSweepResult = {
    scanned: batch.length,
    refreshed,
    pendingReauth,
    failed,
    truncated,
  };
  deps.log({ event: "oauth_refresh_sweep", ...result });
  return result;
}
