import { describe, expect, it } from "vitest";
import {
  isOrgRuntimeEnv,
  productionLockoutEvent,
  resolveRuntimeEnv,
  selectRowsForWorkerEnv,
  workerOrgScope,
} from "../../src/lib/runtime-env";

describe("isOrgRuntimeEnv", () => {
  it("accepts the three Worker environments", () => {
    expect(isOrgRuntimeEnv("dev")).toBe(true);
    expect(isOrgRuntimeEnv("staging")).toBe(true);
    expect(isOrgRuntimeEnv("production")).toBe(true);
  });

  it("rejects empty and unknown values", () => {
    expect(isOrgRuntimeEnv("")).toBe(false);
    expect(isOrgRuntimeEnv("local")).toBe(false);
    expect(isOrgRuntimeEnv(undefined)).toBe(false);
  });
});

describe("resolveRuntimeEnv", () => {
  it("prefers an explicit BASEOUT_ENV", () => {
    expect(
      resolveRuntimeEnv({ BASEOUT_ENV: "staging", BASEOUT_DEV: "true" }),
    ).toBe("staging");
  });

  it("falls back to dev when BASEOUT_DEV is true", () => {
    expect(resolveRuntimeEnv({ BASEOUT_DEV: "true" })).toBe("dev");
  });

  it("fails closed when neither signal is valid", () => {
    expect(resolveRuntimeEnv({})).toBe(null);
    expect(resolveRuntimeEnv({ BASEOUT_ENV: "preview" })).toBe(null);
  });
});

describe("selectRowsForWorkerEnv", () => {
  const rows = [
    { id: "staging-run", runtimeEnv: "staging" },
    { id: "dev-run", runtimeEnv: "dev" },
  ];

  it("drops stuck runs that belong to the other env", () => {
    expect(selectRowsForWorkerEnv(rows, "dev").map((r) => r.id)).toEqual([
      "dev-run",
    ]);
    expect(selectRowsForWorkerEnv(rows, "staging").map((r) => r.id)).toEqual([
      "staging-run",
    ]);
  });

  it("matches nothing when the Worker env is unknown", () => {
    expect(selectRowsForWorkerEnv(rows, null)).toEqual([]);
  });
});

describe("workerOrgScope", () => {
  it("fail-closes to a sentinel that matches no org row", () => {
    expect(workerOrgScope({})).toBe("__none__");
  });
});

describe("productionLockoutEvent", () => {
  it("fires when production sees zero production-tagged orgs in a non-empty table", () => {
    expect(
      productionLockoutEvent({
        resolvedEnv: "production",
        organizationCount: 4,
        productionTaggedCount: 0,
      }),
    ).toMatchObject({ event: "production_runtime_env_lockout" });
  });
});
