import { describe, expect, it, vi } from "vitest";
import type { EntitlementMap, ResolvedFeature } from "@baseout/db-schema";
import {
  evaluateUsageForOrg,
  type UsageEnforcementDeps,
} from "../../src/lib/entitlements/usage-enforcement";
import {
  createSkeletonNotifier,
  type LimitNotificationEvent,
} from "../../src/lib/entitlements/notify";

function limitFeature(slug: string, limit: number | null): ResolvedFeature {
  return {
    slug,
    valueType: "limit",
    enumValues: null,
    meterable: true,
    meterKind: "stock",
    planValue: { type: "limit", limit },
    overrideValue: null,
    addonBonus: 0,
    effective: { type: "limit", limit },
  };
}

function mapOf(...features: ResolvedFeature[]): EntitlementMap {
  const map: EntitlementMap = {};
  for (const f of features) map[f.slug] = f;
  return map;
}

const PERIOD = {
  start: new Date("2026-08-01T00:00:00Z"),
  end: new Date("2026-09-01T00:00:00Z"),
};
const NOW = new Date("2026-08-15T00:00:00Z");

function makeDeps(overrides: Partial<UsageEnforcementDeps> = {}): {
  deps: UsageEnforcementDeps;
  events: LimitNotificationEvent[];
  writeStates: ReturnType<typeof vi.fn>;
} {
  const events: LimitNotificationEvent[] = [];
  const writeStates = vi.fn(async () => {});
  const deps: UsageEnforcementDeps = {
    resolveEntitlements: async () => mapOf(limitFeature("records_under_management", 1000)),
    readUsage: async () => [{ featureSlug: "records_under_management", used: 920 }],
    readStates: async () => [{ featureSlug: "records_under_management", state: "ok" }],
    writeStates,
    notifier: createSkeletonNotifier((e) => events.push(e)),
    enforcementEnabled: false,
    ...overrides,
  };
  return { deps, events, writeStates };
}

const input = {
  organizationId: "org_1",
  featureSlugs: ["records_under_management"],
  period: PERIOD,
  now: NOW,
};

describe("evaluateUsageForOrg", () => {
  it("persists the moved state and fires a warning when crossing 90%", async () => {
    const { deps, events, writeStates } = makeDeps();
    const result = await evaluateUsageForOrg(input, deps);

    expect(result).toEqual({ evaluated: 1, changed: 1, notified: 1 });
    expect(writeStates).toHaveBeenCalledOnce();
    const [orgId, periodStart, changed, at] = writeStates.mock.calls[0];
    expect(orgId).toBe("org_1");
    expect(periodStart).toBe(PERIOD.start);
    expect(changed[0]).toMatchObject({ featureSlug: "records_under_management", next: "warned_90" });
    expect(at).toBe(NOW);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("warning");
  });

  it("skips everything when the org has no resolvable entitlements", async () => {
    const { deps, events, writeStates } = makeDeps({
      resolveEntitlements: async () => null,
    });
    const result = await evaluateUsageForOrg(input, deps);
    expect(result).toEqual({ evaluated: 0, changed: 0, notified: 0 });
    expect(writeStates).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it("does not write or notify when nothing moved (dedupe within a tier)", async () => {
    const { deps, events, writeStates } = makeDeps({
      readUsage: async () => [{ featureSlug: "records_under_management", used: 950 }],
      readStates: async () => [{ featureSlug: "records_under_management", state: "warned_90" }],
    });
    const result = await evaluateUsageForOrg(input, deps);
    expect(result).toEqual({ evaluated: 1, changed: 0, notified: 0 });
    expect(writeStates).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it("fires enforcement (not warning) at 100% when the flag is on", async () => {
    const { deps, events } = makeDeps({
      readUsage: async () => [{ featureSlug: "records_under_management", used: 1000 }],
      readStates: async () => [{ featureSlug: "records_under_management", state: "warned_90" }],
      enforcementEnabled: true,
    });
    const result = await evaluateUsageForOrg(input, deps);
    expect(result.notified).toBe(1);
    expect(events[0].kind).toBe("enforcement");
  });

  it("persists a de-escalation without re-notifying", async () => {
    const { deps, events, writeStates } = makeDeps({
      readUsage: async () => [{ featureSlug: "records_under_management", used: 100 }], // 10%
      readStates: async () => [{ featureSlug: "records_under_management", state: "warned_90" }],
    });
    const result = await evaluateUsageForOrg(input, deps);
    expect(result).toEqual({ evaluated: 1, changed: 1, notified: 0 });
    expect(writeStates).toHaveBeenCalledOnce();
    expect(writeStates.mock.calls[0][2][0]).toMatchObject({ next: "ok" });
    expect(events).toHaveLength(0);
  });
});
