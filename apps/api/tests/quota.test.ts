// Quota evaluation (api-productionization 4.2): the pure decision, the
// fail-open rules, cache behavior, and the zero-cost short-circuit.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/entitlements", () => ({ resolveApiPlan: vi.fn() }));
vi.mock("../src/lib/usage", async (orig) => ({
  ...(await orig()),
  readMonthlyUsage: vi.fn(),
}));

import { resolveApiPlan } from "../src/lib/entitlements";
import { readMonthlyUsage } from "../src/lib/usage";
import { _resetQuotaCaches, evaluateQuota, quotaDecision, secondsToMonthEnd } from "../src/lib/quota";
import type { Env } from "../src/env";

const now = new Date("2026-08-27T12:00:00Z");
const db = {} as never;
const CREDS = { AE_ACCOUNT_ID: "acc", AE_API_TOKEN: "tok" } as Env;

beforeEach(() => _resetQuotaCaches());
afterEach(() => vi.clearAllMocks());

describe("quotaDecision (pure)", () => {
  it("under the allowance → headers, no block, regardless of enforcement", () => {
    const d = quotaDecision(50000, 100, true, now);
    expect(d).toEqual({ block: false, headers: { "x-quota-limit": "50000", "x-quota-remaining": "49900" } });
  });

  it("exhausted + enforce → block with Retry-After to the month boundary", () => {
    const d = quotaDecision(100, 100, true, now);
    expect(d.block).toBe(true);
    expect(d.headers["x-quota-remaining"]).toBe("0");
    expect(Number(d.headers["retry-after"])).toBe(secondsToMonthEnd(now));
  });

  it("exhausted + shadow → headers say 0 remaining but no block", () => {
    expect(quotaDecision(100, 250, false, now).block).toBe(false);
  });

  it("fail-open: null allowance (fair use) or null usage (unknown) never blocks", () => {
    expect(quotaDecision(null, 999999, true, now).block).toBe(false);
    expect(quotaDecision(100, null, true, now)).toEqual({ block: false, headers: { "x-quota-limit": "100" } });
  });
});

describe("evaluateQuota (pipeline entry)", () => {
  it("zero-cost short-circuit: no creds + enforcement off → no plan lookup at all", async () => {
    const d = await evaluateQuota({} as Env, db, "org_1", now);
    expect(d).toEqual({ block: false, headers: {} });
    expect(resolveApiPlan).not.toHaveBeenCalled();
  });

  it("reads plan + usage and blocks when exhausted under enforcement", async () => {
    vi.mocked(resolveApiPlan).mockResolvedValue({ planSlug: "lite", monthlyCallAllowance: 10, apiAccess: true, mcpAccess: true });
    vi.mocked(readMonthlyUsage).mockResolvedValue(10);
    const d = await evaluateQuota({ ...CREDS, QUOTA_ENFORCE: "true" } as Env, db, "org_1", now);
    expect(d.block).toBe(true);
  });

  it("caches the plan and usage per org (one resolution across repeat calls)", async () => {
    vi.mocked(resolveApiPlan).mockResolvedValue({ planSlug: "core", monthlyCallAllowance: 50000, apiAccess: true, mcpAccess: true });
    vi.mocked(readMonthlyUsage).mockResolvedValue(5);
    await evaluateQuota(CREDS, db, "org_1", now);
    await evaluateQuota(CREDS, db, "org_1", new Date(now.getTime() + 1000));
    expect(resolveApiPlan).toHaveBeenCalledTimes(1);
    expect(readMonthlyUsage).toHaveBeenCalledTimes(1);
  });

  it("a thrown plan resolution fails open", async () => {
    vi.mocked(resolveApiPlan).mockRejectedValue(new Error("db down"));
    const d = await evaluateQuota({ ...CREDS, QUOTA_ENFORCE: "true" } as Env, db, "org_1", now);
    expect(d).toEqual({ block: false, headers: {} });
  });
});
