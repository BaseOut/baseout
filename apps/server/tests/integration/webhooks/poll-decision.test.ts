// Pure webhook-poll decision logic (server-instant-webhook Phase C).
//
// Pins the dirty-check predicate (dirty / clean / safety-sweep-due /
// never-polled / ping-races-poll), the reconcile-cadence decision, the
// in-flight + paused-webhook skips, and the jittered next-poll computation.
// The SpaceDO wiring on top is covered by space-do-webhook-poll.test.ts.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEBHOOK_POLL_INTERVAL_SECONDS,
  RECONCILE_CADENCE_MS,
  SAFETY_SWEEP_MS,
  computeNextWebhookPollMs,
  decideWebhookPolls,
  isSubscriptionDue,
  needsReconcile,
  type PollSubscription,
} from "../../../src/lib/webhooks/poll";

const NOW = new Date("2030-01-15T14:23:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

function sub(overrides: Partial<PollSubscription> = {}): PollSubscription {
  return {
    subscriptionId: "11111111-1111-1111-1111-111111111111",
    webhookId: "22222222-2222-2222-2222-222222222222",
    baseId: "appAAAAAAAAAAAAAA",
    connectionId: "33333333-3333-3333-3333-333333333333",
    webhookStatus: "active",
    payloadCursor: 7,
    lastPingAt: new Date(NOW.getTime() - HOUR_MS),
    lastPolledAt: new Date(NOW.getTime() - 2 * HOUR_MS),
    lastReconciledAt: new Date(NOW.getTime() - HOUR_MS),
    ...overrides,
  };
}

describe("isSubscriptionDue", () => {
  it("dirty: last_ping_at newer than last_polled_at", () => {
    expect(isSubscriptionDue(sub(), NOW)).toBe(true);
  });

  it("clean: polled after the last ping, sweep not due", () => {
    expect(
      isSubscriptionDue(
        sub({
          lastPingAt: new Date(NOW.getTime() - 2 * HOUR_MS),
          lastPolledAt: new Date(NOW.getTime() - HOUR_MS),
        }),
        NOW,
      ),
    ).toBe(false);
  });

  it("safety sweep: due when last_polled_at is older than 24h even with no ping", () => {
    expect(
      isSubscriptionDue(
        sub({
          lastPingAt: null,
          lastPolledAt: new Date(NOW.getTime() - SAFETY_SWEEP_MS - 1),
        }),
        NOW,
      ),
    ).toBe(true);
  });

  it("never polled: due even with no ping (COALESCE-to-epoch semantics)", () => {
    expect(isSubscriptionDue(sub({ lastPingAt: null, lastPolledAt: null }), NOW)).toBe(
      true,
    );
  });

  it("ping racing a poll: a ping stamped after last_polled_at re-dirties the next tick", () => {
    const polledAt = new Date(NOW.getTime() - 10_000);
    expect(
      isSubscriptionDue(
        sub({
          lastPolledAt: polledAt,
          lastPingAt: new Date(polledAt.getTime() + 1),
        }),
        NOW,
      ),
    ).toBe(true);
  });
});

describe("needsReconcile", () => {
  it("true when never reconciled", () => {
    expect(needsReconcile(null, NOW)).toBe(true);
  });

  it("true when older than the 7-day cadence", () => {
    expect(
      needsReconcile(new Date(NOW.getTime() - RECONCILE_CADENCE_MS - 1), NOW),
    ).toBe(true);
  });

  it("false when reconciled within the cadence", () => {
    expect(needsReconcile(new Date(NOW.getTime() - HOUR_MS), NOW)).toBe(false);
  });
});

describe("computeNextWebhookPollMs", () => {
  it("random()=0 → exactly now + interval", () => {
    expect(computeNextWebhookPollMs(900, NOW.getTime(), () => 0)).toBe(
      NOW.getTime() + 900_000,
    );
  });

  it("jitter is bounded to +10% of the interval", () => {
    const next = computeNextWebhookPollMs(900, NOW.getTime(), () => 0.999999);
    expect(next).toBeGreaterThanOrEqual(NOW.getTime() + 900_000);
    expect(next).toBeLessThan(NOW.getTime() + 990_000);
  });

  it("default interval is 900s", () => {
    expect(DEFAULT_WEBHOOK_POLL_INTERVAL_SECONDS).toBe(900);
  });
});

describe("decideWebhookPolls", () => {
  it("dirty subscription → enqueue with the stored cursor + reconcile flag", () => {
    const s = sub({ lastReconciledAt: null });
    const decisions = decideWebhookPolls({
      subscriptions: [s],
      inFlightBaseIds: new Set(),
      now: NOW,
    });
    expect(decisions).toEqual([
      { action: "enqueue", subscription: s, reconcile: true },
    ]);
  });

  it("reconcile=false when last_reconciled_at is within 7 days", () => {
    const decisions = decideWebhookPolls({
      subscriptions: [sub()],
      inFlightBaseIds: new Set(),
      now: NOW,
    });
    expect(decisions[0]).toMatchObject({ action: "enqueue", reconcile: false });
  });

  it("in-flight guard: skips a base with a non-terminal webhook run", () => {
    const s = sub();
    const decisions = decideWebhookPolls({
      subscriptions: [s],
      inFlightBaseIds: new Set([s.baseId]),
      now: NOW,
    });
    expect(decisions).toEqual([
      { action: "skip_in_flight", subscription: s },
    ]);
  });

  it("clean subscription (defense-in-depth over the SQL WHERE) → skipped", () => {
    const decisions = decideWebhookPolls({
      subscriptions: [
        sub({
          lastPingAt: new Date(NOW.getTime() - 2 * HOUR_MS),
          lastPolledAt: new Date(NOW.getTime() - HOUR_MS),
        }),
      ],
      inFlightBaseIds: new Set(),
      now: NOW,
    });
    expect(decisions).toEqual([]);
  });

  it("paused webhook (pending_reauth / inactive) → skipped", () => {
    for (const webhookStatus of ["pending_reauth", "inactive"]) {
      const s = sub({ webhookStatus });
      const decisions = decideWebhookPolls({
        subscriptions: [s],
        inFlightBaseIds: new Set(),
        now: NOW,
      });
      expect(decisions).toEqual([{ action: "skip_paused", subscription: s }]);
    }
  });

  it("notifications_disabled still polls (payload generation continues while muted)", () => {
    const decisions = decideWebhookPolls({
      subscriptions: [sub({ webhookStatus: "notifications_disabled" })],
      inFlightBaseIds: new Set(),
      now: NOW,
    });
    expect(decisions[0]).toMatchObject({ action: "enqueue" });
  });
});
