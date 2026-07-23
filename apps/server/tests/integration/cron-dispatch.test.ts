// Pure tests for the scheduled() cron dispatch router + OAuth refresh sweep
// (server-oauth-refresh-cron-health). No DB, no DO — deps injected, per the
// house runs-lifecycle pattern. Placed under tests/integration/** so the
// server test runner picks it up.

import { describe, expect, it, vi } from "vitest";
import {
  OAUTH_REFRESH_CRON,
  KEEPALIVE_CRON,
  WEBHOOK_RENEWAL_CRON,
  resolveCronJobs,
} from "../../src/lib/cron/dispatch";
import {
  runOauthRefreshSweep,
  type OauthRefreshSweepDeps,
} from "../../src/lib/cron/oauth-refresh-sweep";

describe("resolveCronJobs", () => {
  it("maps the */15 cron to the oauth refresh sweep + run reconciliation", () => {
    expect(resolveCronJobs(OAUTH_REFRESH_CRON)).toEqual([
      "oauth-refresh-sweep",
      "run-reconciliation",
    ]);
  });

  it("maps the daily keep-alive cron to keep-alive + auto-invalidate + service-runs-prune", () => {
    expect(resolveCronJobs(KEEPALIVE_CRON)).toEqual([
      "oauth-keepalive",
      "connection-auto-invalidate",
      "service-runs-prune",
    ]);
  });

  it("maps the hourly cron to webhook renewal (server-cron-webhook-renewal)", () => {
    expect(WEBHOOK_RENEWAL_CRON).toBe("0 * * * *");
    expect(resolveCronJobs(WEBHOOK_RENEWAL_CRON)).toEqual(["webhook-renewal"]);
  });

  it("the crons are distinct strings (no accidental collision)", () => {
    const crons = [OAUTH_REFRESH_CRON, KEEPALIVE_CRON, WEBHOOK_RENEWAL_CRON];
    expect(new Set(crons).size).toBe(crons.length);
  });

  it("unknown cron strings resolve to no jobs (logged no-op at the call site)", () => {
    expect(resolveCronJobs("0 6 * * *")).toEqual([]);
  });
});

function makeDeps(over: Partial<OauthRefreshSweepDeps> = {}): OauthRefreshSweepDeps & {
  log: ReturnType<typeof vi.fn>;
} {
  return {
    listStaleConnections: vi.fn(async () => [{ id: "c1" }, { id: "c2" }]),
    refreshConnection: vi.fn(async () => "refreshed" as const),
    log: vi.fn(),
    ...over,
  };
}

describe("runOauthRefreshSweep", () => {
  it("refreshes every stale connection and logs one summary", async () => {
    const deps = makeDeps();
    const result = await runOauthRefreshSweep(deps);
    expect(result).toEqual({
      scanned: 2,
      refreshed: 2,
      pendingReauth: 0,
      failed: 0,
      truncated: false,
    });
    expect(deps.refreshConnection).toHaveBeenCalledTimes(2);
    expect(deps.log).toHaveBeenCalledTimes(1);
    expect(deps.log.mock.calls[0]![0]).toMatchObject({
      event: "oauth_refresh_sweep",
      scanned: 2,
      refreshed: 2,
    });
  });

  it("classifies outcomes: refreshed / pending_reauth / failed", async () => {
    const outcomes = ["refreshed", "pending_reauth", "failed"] as const;
    let i = 0;
    const deps = makeDeps({
      listStaleConnections: vi.fn(async () => [{ id: "a" }, { id: "b" }, { id: "c" }]),
      refreshConnection: vi.fn(async () => outcomes[i++]!),
    });
    const result = await runOauthRefreshSweep(deps);
    expect(result).toMatchObject({ scanned: 3, refreshed: 1, pendingReauth: 1, failed: 1 });
  });

  it("a throwing refresh counts as failed and never aborts the sweep", async () => {
    const deps = makeDeps({
      listStaleConnections: vi.fn(async () => [{ id: "boom" }, { id: "ok" }]),
      refreshConnection: vi
        .fn()
        .mockRejectedValueOnce(new Error("do exploded"))
        .mockResolvedValueOnce("refreshed"),
    });
    const result = await runOauthRefreshSweep(deps);
    expect(result).toMatchObject({ scanned: 2, refreshed: 1, failed: 1 });
  });

  it("caps work per firing and logs truncation (no silent caps)", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}` }));
    const deps = makeDeps({
      listStaleConnections: vi.fn(async (limit: number) => rows.slice(0, limit)),
      maxPerSweep: 25,
    });
    const result = await runOauthRefreshSweep(deps);
    expect(deps.listStaleConnections).toHaveBeenCalledWith(26); // max + 1 to detect overflow
    expect(result.truncated).toBe(true);
    expect(deps.refreshConnection).toHaveBeenCalledTimes(25);
    expect(deps.log.mock.calls[0]![0]).toMatchObject({ truncated: true });
  });

  it("an empty sweep writes nothing and logs scanned=0", async () => {
    const deps = makeDeps({ listStaleConnections: vi.fn(async () => []) });
    const result = await runOauthRefreshSweep(deps);
    expect(result).toMatchObject({ scanned: 0, refreshed: 0 });
    expect(deps.refreshConnection).not.toHaveBeenCalled();
    expect(deps.log.mock.calls[0]![0]).toMatchObject({ scanned: 0 });
  });
});
