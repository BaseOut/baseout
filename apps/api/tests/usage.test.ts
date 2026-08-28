// AE usage read (api-productionization D3): query shape, unconfigured null,
// failure-isolated null, zero-rows → 0.
import { afterEach, describe, expect, it, vi } from "vitest";
import { monthStartUtc, readMonthlyUsage, usageQuery } from "../src/lib/usage";
import type { Env } from "../src/env";

const now = new Date("2026-08-27T14:00:00Z");

afterEach(() => vi.unstubAllGlobals());

describe("usageQuery / monthStartUtc", () => {
  it("counts sample-weighted calls for the org since the UTC month start", () => {
    expect(monthStartUtc(now).toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(usageQuery("org_1", monthStartUtc(now))).toBe(
      "SELECT sum(_sample_interval * double1) AS calls FROM baseout_api_requests WHERE blob2 = 'org_1' AND timestamp >= toDateTime('2026-08-01 00:00:00')",
    );
  });
  it("escapes single quotes in the org id", () => {
    expect(usageQuery("o'rg", monthStartUtc(now))).toContain("blob2 = 'o''rg'");
  });
});

describe("readMonthlyUsage", () => {
  it("null without credentials — never fetches", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await readMonthlyUsage({} as Env, "org_1", now)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sums the returned calls; zero rows → 0; HTTP failure → null", async () => {
    const env = { AE_ACCOUNT_ID: "acc", AE_API_TOKEN: "tok" } as Env;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ calls: "1234.0" }] }))));
    expect(await readMonthlyUsage(env, "org_1", now)).toBe(1234);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [] }))));
    expect(await readMonthlyUsage(env, "org_1", now)).toBe(0);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect(await readMonthlyUsage(env, "org_1", now)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net"); }));
    expect(await readMonthlyUsage(env, "org_1", now)).toBeNull();
  });
});
