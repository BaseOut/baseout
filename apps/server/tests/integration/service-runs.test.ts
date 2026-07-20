// Pure-logic tests for the service-run writer orchestration (shared-service-runs).
// The drizzle adapter (drizzleWriter) is the thin I/O layer, smoke-verified; the
// orchestration (open → body → finalize, with all record-keeping failures
// swallowed so the job outcome is never affected) is unit-tested here via a fake
// writer.

import { describe, expect, it } from "vitest";
import {
  SERVICE_IDS,
  numericCounts,
  pruneCutoff,
  withServiceRunVia,
  type ServiceRunWriter,
} from "../../src/lib/service-runs";

function fakeWriter(over: Partial<ServiceRunWriter> = {}): ServiceRunWriter & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    open: over.open ?? (async (service) => { calls.push(["open", service]); return "run_1"; }),
    finalize: over.finalize ?? (async (id, outcome) => { calls.push(["finalize", id, outcome]); }),
  };
}

describe("SERVICE_IDS", () => {
  it("lists the six live services + reserved future ones", () => {
    expect(SERVICE_IDS.live).toContain("oauth_refresh_sweep");
    expect(SERVICE_IDS.live).toContain("retention_cleanup");
    expect(SERVICE_IDS.live).toContain("service_runs_prune");
    expect(SERVICE_IDS.reserved).toContain("webhook_renewal");
  });
});

describe("withServiceRunVia", () => {
  it("success: opens, runs body, finalizes succeeded with the body's counts, returns the result", async () => {
    const w = fakeWriter();
    const result = await withServiceRunVia(w, "oauth_refresh_sweep", async () => ({ counts: { scanned: 3, refreshed: 2 } }));
    expect(result.counts).toEqual({ scanned: 3, refreshed: 2 });
    expect(w.calls[0]).toEqual(["open", "oauth_refresh_sweep"]);
    const [, id, outcome] = w.calls[1] as [string, string, { status: string; counts: unknown }];
    expect(id).toBe("run_1");
    expect(outcome.status).toBe("succeeded");
    expect(outcome.counts).toEqual({ scanned: 3, refreshed: 2 });
  });

  it("body throws: finalizes failed with the message, then rethrows (job error preserved)", async () => {
    const w = fakeWriter();
    await expect(withServiceRunVia(w, "run_reconciliation", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    const [, , outcome] = w.calls[1] as [string, string, { status: string; errorMessage: string }];
    expect(outcome.status).toBe("failed");
    expect(outcome.errorMessage).toContain("boom");
  });

  it("open returns null (insert failed): the body still runs and its result is returned", async () => {
    const w = fakeWriter({ open: async () => null });
    const result = await withServiceRunVia(w, "oauth_keepalive", async () => ({ counts: { refreshed: 1 } }));
    expect(result.counts).toEqual({ refreshed: 1 });
    // finalize is still called (with a null id → the adapter no-ops).
    const [, id] = w.calls.find((c) => (c as string[])[0] === "finalize") as [string, string | null];
    expect(id).toBeNull();
  });

  it("finalize throws: the original success result is still returned (record-keeping never breaks the job)", async () => {
    const w = fakeWriter({ finalize: async () => { throw new Error("db down"); } });
    const result = await withServiceRunVia(w, "connection_auto_invalidate", async () => ({ counts: { invalidated: 0 } }));
    expect(result.counts).toEqual({ invalidated: 0 });
  });

  it("finalize throws on a body failure: the body error still propagates", async () => {
    const w = fakeWriter({ finalize: async () => { throw new Error("db down"); } });
    await expect(withServiceRunVia(w, "run_reconciliation", async () => { throw new Error("job failed"); })).rejects.toThrow("job failed");
  });

  it("body with no counts: finalizes succeeded with no counts", async () => {
    const w = fakeWriter();
    await withServiceRunVia(w, "service_runs_prune", async () => ({}));
    const [, , outcome] = w.calls[1] as [string, string, { status: string; counts?: unknown }];
    expect(outcome.status).toBe("succeeded");
    expect(outcome.counts).toBeUndefined();
  });
});

describe("pruneCutoff", () => {
  it("is exactly 90 days before now (89d kept / 91d deleted boundary)", () => {
    const now = new Date("2026-07-20T00:00:00.000Z");
    const cutoff = pruneCutoff(now);
    expect(cutoff.toISOString()).toBe("2026-04-21T00:00:00.000Z");
    // a 91-day-old row is before the cutoff (deleted); an 89-day-old row is after (kept).
    const d91 = new Date(now.getTime() - 91 * 86400_000);
    const d89 = new Date(now.getTime() - 89 * 86400_000);
    expect(d91 < cutoff).toBe(true);
    expect(d89 < cutoff).toBe(false);
  });
});

describe("numericCounts", () => {
  it("keeps numeric fields, drops others, tolerates null (skipped job)", () => {
    expect(numericCounts({ scanned: 3, refreshed: 2, note: "x", ok: true })).toEqual({ scanned: 3, refreshed: 2 });
    expect(numericCounts(null)).toEqual({});
    expect(numericCounts(undefined)).toEqual({});
  });
});
