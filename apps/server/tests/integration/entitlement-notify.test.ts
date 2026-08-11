import { describe, expect, it } from "vitest";
import {
  createSkeletonNotifier,
  type LimitNotificationEvent,
} from "../../src/lib/entitlements/notify";

describe("createSkeletonNotifier", () => {
  it("emits a structured warning event through the injected sink", async () => {
    const events: LimitNotificationEvent[] = [];
    const notifier = createSkeletonNotifier((e) => events.push(e));

    await notifier.notifyLimitWarning({
      organizationId: "org_1",
      featureSlug: "records_under_management",
      used: 920,
      limit: 1000,
      pct: 0.92,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: "limit_notification",
      kind: "warning",
      organizationId: "org_1",
      featureSlug: "records_under_management",
      used: 920,
      limit: 1000,
      pct: 0.92,
      todo: "shared-entitlements-5.1-real-email",
    });
  });

  it("emits an enforcement event with kind=enforcement", async () => {
    const events: LimitNotificationEvent[] = [];
    const notifier = createSkeletonNotifier((e) => events.push(e));

    await notifier.notifyLimitEnforced({
      organizationId: "org_2",
      featureSlug: "api_calls",
      used: 150,
      limit: 100,
      pct: 1.5,
    });

    expect(events[0].kind).toBe("enforcement");
    expect(events[0].pct).toBe(1.5);
  });

  it("defaults to a no-op sink (no throw, delivery deferred to 5.1)", async () => {
    const notifier = createSkeletonNotifier();
    await expect(
      notifier.notifyLimitWarning({
        organizationId: "org_3",
        featureSlug: "file_storage_gb",
        used: 9,
        limit: 10,
        pct: 0.9,
      }),
    ).resolves.toBeUndefined();
  });
});
