// SpaceDO webhook cadence polling (server-instant-webhook Phase C).
//
// The webhook-poll lane coexists with the cron-snapshot lane on the DO's
// single alarm via the min-dispatch pattern. Pure decision logic lives in
// src/lib/webhooks/poll.ts (poll-decision.test.ts); this file pins the DO
// wiring: /set-webhook-polling arming, alarm-fire dispatch, the in-flight
// guard's DO-storage map, watermark stamping, enqueue-failure rollback, and
// coexistence with a due cron fire. Spy-injection via runInDurableObject.

import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import type { SpaceDO, SpaceDOAlarmDeps } from "../../src/durable-objects/SpaceDO";
import { computeNextFire } from "../../src/lib/scheduling/next-fire";
import type { PollSubscription } from "../../src/lib/webhooks/poll";

interface Bindings {
  SPACE_DO: DurableObjectNamespace<SpaceDO>;
}

function getStub(name: string): DurableObjectStub<SpaceDO> {
  const ns = (env as unknown as Bindings).SPACE_DO;
  return ns.get(ns.idFromName(name));
}

const ORG_ID = "22222222-2222-2222-2222-222222222222";
const CONFIG_ID = "33333333-3333-3333-3333-333333333333";
const CONN_ID = "44444444-4444-4444-4444-444444444444";
const RUN_ID = "55555555-5555-5555-5555-555555555555";
const SUB_ID = "66666666-6666-6666-6666-666666666666";
const WEBHOOK_ID = "77777777-7777-7777-7777-777777777777";
const BASE_ID = "appAAAAAAAAAAAAAA";
const TRIGGER_RUN_ID = "run_incremental_abc";
// Far-future so workerd doesn't clamp setAlarm(pastTimestamp).
const FIXED_NOW = new Date("2030-01-15T14:23:00.000Z");
const FIRES_KEY = "schedule_fires";
const WEBHOOK_POLL_KEY = "webhook_poll_fire";
const WEBHOOK_INFLIGHT_KEY = "webhook_inflight";
const HOUR_MS = 60 * 60 * 1000;

function subscription(overrides: Partial<PollSubscription> = {}): PollSubscription {
  return {
    subscriptionId: SUB_ID,
    webhookId: WEBHOOK_ID,
    baseId: BASE_ID,
    connectionId: CONN_ID,
    webhookStatus: "active",
    payloadCursor: 42,
    lastPingAt: new Date(FIXED_NOW.getTime() - HOUR_MS),
    lastPolledAt: new Date(FIXED_NOW.getTime() - 2 * HOUR_MS),
    lastReconciledAt: new Date(FIXED_NOW.getTime() - HOUR_MS),
    ...overrides,
  };
}

function depsFor(
  spaceId: string,
  overrides: Partial<SpaceDOAlarmDeps> = {},
): SpaceDOAlarmDeps {
  return {
    now: () => FIXED_NOW,
    random: () => 0,
    fetchSpace: vi.fn(async () => ({ id: spaceId, organizationId: ORG_ID })),
    fetchActiveAirtableConnection: vi.fn(async () => ({
      id: CONN_ID,
      status: "active",
    })),
    fetchConfig: vi.fn(async () => ({
      id: CONFIG_ID,
      scope: "schema_and_data",
      dataFrequency: "instant",
      schemaFrequency: null,
      webhookPollIntervalSeconds: 900,
    })),
    insertScheduledRun: vi.fn(async () => RUN_ID),
    deleteRun: vi.fn(async () => undefined),
    runStart: vi.fn(async () => ({ ok: true })),
    updateNextScheduled: vi.fn(async () => undefined),
    recordSkippedFire: vi.fn(async () => undefined),
    fetchDueWebhookSubscriptions: vi.fn(async () => [subscription()]),
    fetchRunStatuses: vi.fn(async () => ({})),
    insertWebhookRun: vi.fn(async () => RUN_ID),
    markWebhookRunStarted: vi.fn(async () => undefined),
    enqueueIncrementalBackup: vi.fn(async () => ({ id: TRIGGER_RUN_ID })),
    updateSubscriptionPolledAt: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("SpaceDO POST /set-webhook-polling", () => {
  it("arms the jittered poll alarm when enabled", async () => {
    const spaceId = `wp-arm-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(depsFor(spaceId));
      const res = await inst.fetch(
        new Request("http://do/set-webhook-polling", {
          method: "POST",
          body: JSON.stringify({ enabled: true }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; nextPollAt: number | null };
      expect(body.ok).toBe(true);
      // random()=0 → exactly now + 900s.
      expect(body.nextPollAt).toBe(FIXED_NOW.getTime() + 900_000);
      expect(await state.storage.get(WEBHOOK_POLL_KEY)).toBe(
        FIXED_NOW.getTime() + 900_000,
      );
      expect(await state.storage.getAlarm()).toBe(FIXED_NOW.getTime() + 900_000);
    });
  });

  it("arms the alarm at the nearer of poll fire and stored cron fire", async () => {
    const spaceId = `wp-min-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const cronFire = FIXED_NOW.getTime() + 60_000; // nearer than the 900s poll

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(depsFor(spaceId));
      await state.storage.put(FIRES_KEY, {
        dataNextFire: null,
        schemaNextFire: cronFire,
      });
      const res = await inst.fetch(
        new Request("http://do/set-webhook-polling", {
          method: "POST",
          body: JSON.stringify({ enabled: true }),
        }),
      );
      expect(res.status).toBe(200);
      expect(await state.storage.getAlarm()).toBe(cronFire);
    });
  });

  it("disabling clears poll state and re-arms from the stored cron fires", async () => {
    const spaceId = `wp-off-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const cronFire = FIXED_NOW.getTime() + 5 * HOUR_MS;

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(depsFor(spaceId));
      await state.storage.put(WEBHOOK_POLL_KEY, FIXED_NOW.getTime() + 900_000);
      await state.storage.put(FIRES_KEY, {
        dataNextFire: cronFire,
        schemaNextFire: null,
      });
      const res = await inst.fetch(
        new Request("http://do/set-webhook-polling", {
          method: "POST",
          body: JSON.stringify({ enabled: false }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; nextPollAt: number | null };
      expect(body.nextPollAt).toBeNull();
      expect(await state.storage.get(WEBHOOK_POLL_KEY)).toBeUndefined();
      expect(await state.storage.getAlarm()).toBe(cronFire);
    });
  });

  it("returns 405 on non-POST and 400 on a bad body", async () => {
    const stub = getStub(`wp-bad-${crypto.randomUUID()}`);
    const get = await stub.fetch("http://do/set-webhook-polling", { method: "GET" });
    expect(get.status).toBe(405);
    const bad = await stub.fetch("http://do/set-webhook-polling", {
      method: "POST",
      body: JSON.stringify({ enabled: "yes" }),
    });
    expect(bad.status).toBe(400);
  });
});

describe("SpaceDO alarm() — webhook poll lane", () => {
  it("dirty subscription → run row + incremental enqueue + watermark + re-arm", async () => {
    const spaceId = `wp-fire-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId);

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      await state.storage.put(WEBHOOK_POLL_KEY, FIXED_NOW.getTime() - 1000);
      await inst.alarm();
      // Re-armed one jittered interval out (random()=0 → exact).
      expect(await state.storage.get(WEBHOOK_POLL_KEY)).toBe(
        FIXED_NOW.getTime() + 900_000,
      );
      expect(await state.storage.getAlarm()).toBe(FIXED_NOW.getTime() + 900_000);
      // The enqueued run is tracked for the next tick's in-flight guard.
      expect(await state.storage.get(WEBHOOK_INFLIGHT_KEY)).toEqual({
        [BASE_ID]: RUN_ID,
      });
    });

    expect(deps.fetchDueWebhookSubscriptions).toHaveBeenCalledWith(
      spaceId,
      FIXED_NOW,
    );
    expect(deps.insertWebhookRun).toHaveBeenCalledWith({
      spaceId,
      connectionId: CONN_ID,
    });
    expect(deps.enqueueIncrementalBackup).toHaveBeenCalledWith({
      runId: RUN_ID,
      spaceId,
      subscriptionId: SUB_ID,
      baseId: BASE_ID,
      connectionId: CONN_ID,
      cursor: 42,
      reconcile: false,
    });
    expect(deps.markWebhookRunStarted).toHaveBeenCalledWith(
      RUN_ID,
      TRIGGER_RUN_ID,
      FIXED_NOW,
    );
    expect(deps.updateSubscriptionPolledAt).toHaveBeenCalledWith(SUB_ID, FIXED_NOW);
    // No cron fire happened (instant = no scheduled data cadence).
    expect(deps.insertScheduledRun).not.toHaveBeenCalled();
  });

  it("passes reconcile=true when last_reconciled_at is stale (> 7 days)", async () => {
    const spaceId = `wp-reconcile-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, {
      fetchDueWebhookSubscriptions: vi.fn(async () => [
        subscription({ lastReconciledAt: null }),
      ]),
    });

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      await state.storage.put(WEBHOOK_POLL_KEY, FIXED_NOW.getTime() - 1000);
      await inst.alarm();
    });

    expect(deps.enqueueIncrementalBackup).toHaveBeenCalledWith(
      expect.objectContaining({ reconcile: true }),
    );
  });

  it("clean tick: no dirty subscriptions → no run, still re-arms", async () => {
    const spaceId = `wp-clean-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, {
      fetchDueWebhookSubscriptions: vi.fn(async () => []),
    });

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      await state.storage.put(WEBHOOK_POLL_KEY, FIXED_NOW.getTime() - 1000);
      await inst.alarm();
      expect(await state.storage.getAlarm()).toBe(FIXED_NOW.getTime() + 900_000);
    });

    expect(deps.insertWebhookRun).not.toHaveBeenCalled();
    expect(deps.enqueueIncrementalBackup).not.toHaveBeenCalled();
    expect(deps.updateSubscriptionPolledAt).not.toHaveBeenCalled();
  });

  it("in-flight guard: skips the base while its run is non-terminal, keeps the watermark", async () => {
    const spaceId = `wp-inflight-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const inflightRunId = "99999999-9999-9999-9999-999999999999";
    const deps = depsFor(spaceId, {
      fetchRunStatuses: vi.fn(async () => ({ [inflightRunId]: "running" })),
    });

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      await state.storage.put(WEBHOOK_POLL_KEY, FIXED_NOW.getTime() - 1000);
      await state.storage.put(WEBHOOK_INFLIGHT_KEY, { [BASE_ID]: inflightRunId });
      await inst.alarm();
      // Entry retained so the next tick re-checks.
      expect(await state.storage.get(WEBHOOK_INFLIGHT_KEY)).toEqual({
        [BASE_ID]: inflightRunId,
      });
    });

    expect(deps.fetchRunStatuses).toHaveBeenCalledWith([inflightRunId]);
    expect(deps.insertWebhookRun).not.toHaveBeenCalled();
    expect(deps.updateSubscriptionPolledAt).not.toHaveBeenCalled();
  });

  it("terminal in-flight run is pruned and the base enqueues again", async () => {
    const spaceId = `wp-terminal-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const oldRunId = "99999999-9999-9999-9999-999999999999";
    const deps = depsFor(spaceId, {
      fetchRunStatuses: vi.fn(async () => ({ [oldRunId]: "succeeded" })),
    });

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      await state.storage.put(WEBHOOK_POLL_KEY, FIXED_NOW.getTime() - 1000);
      await state.storage.put(WEBHOOK_INFLIGHT_KEY, { [BASE_ID]: oldRunId });
      await inst.alarm();
      expect(await state.storage.get(WEBHOOK_INFLIGHT_KEY)).toEqual({
        [BASE_ID]: RUN_ID,
      });
    });

    expect(deps.insertWebhookRun).toHaveBeenCalledOnce();
    expect(deps.enqueueIncrementalBackup).toHaveBeenCalledOnce();
  });

  it("rolls back the run row and keeps the watermark when the enqueue fails", async () => {
    const spaceId = `wp-rollback-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, {
      enqueueIncrementalBackup: vi.fn(async () => {
        throw new Error("trigger.dev unreachable");
      }),
    });

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      await state.storage.put(WEBHOOK_POLL_KEY, FIXED_NOW.getTime() - 1000);
      await inst.alarm();
      // Still re-arms so the next interval retries.
      expect(await state.storage.get(WEBHOOK_POLL_KEY)).toBe(
        FIXED_NOW.getTime() + 900_000,
      );
      expect(await state.storage.get(WEBHOOK_INFLIGHT_KEY)).toEqual({});
    });

    expect(deps.deleteRun).toHaveBeenCalledWith(RUN_ID);
    expect(deps.markWebhookRunStarted).not.toHaveBeenCalled();
    expect(deps.updateSubscriptionPolledAt).not.toHaveBeenCalled();
  });

  it("a not-yet-due poll is left armed while a due cron fire dispatches (coexistence)", async () => {
    const spaceId = `wp-coexist-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const pollFire = FIXED_NOW.getTime() + 600_000; // not due
    const deps = depsFor(spaceId, {
      fetchConfig: vi.fn(async () => ({
        id: CONFIG_ID,
        scope: "schema_and_data",
        dataFrequency: "instant",
        schemaFrequency: "daily",
        webhookPollIntervalSeconds: 900,
      })),
    });

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      await state.storage.put(FIRES_KEY, {
        dataNextFire: null,
        schemaNextFire: FIXED_NOW.getTime() - 1000, // schema cron due
      });
      await state.storage.put(WEBHOOK_POLL_KEY, pollFire);
      await inst.alarm();
      // Poll untouched; alarm re-armed at the nearer of poll vs next schema fire.
      expect(await state.storage.get(WEBHOOK_POLL_KEY)).toBe(pollFire);
      const nextSchema = computeNextFire("daily", FIXED_NOW);
      expect(await state.storage.getAlarm()).toBe(Math.min(pollFire, nextSchema));
    });

    // The cron lane fired (schema run) while the poll lane stayed idle.
    expect(deps.insertScheduledRun).toHaveBeenCalledWith({
      spaceId,
      connectionId: CONN_ID,
      kind: "schema",
    });
    expect(deps.fetchDueWebhookSubscriptions).not.toHaveBeenCalled();
  });

  it("drops poll state when the config is no longer instant", async () => {
    const spaceId = `wp-drop-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, {
      fetchConfig: vi.fn(async () => ({
        id: CONFIG_ID,
        scope: "schema_and_data",
        dataFrequency: "daily",
        schemaFrequency: null,
        webhookPollIntervalSeconds: 900,
      })),
    });

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      await state.storage.put(WEBHOOK_POLL_KEY, FIXED_NOW.getTime() - 1000);
      await inst.alarm();
      expect(await state.storage.get(WEBHOOK_POLL_KEY)).toBeUndefined();
      // Cron lane still owns the alarm (daily data cadence).
      expect(await state.storage.getAlarm()).toBe(computeNextFire("daily", FIXED_NOW));
    });

    expect(deps.fetchDueWebhookSubscriptions).not.toHaveBeenCalled();
  });

  it("self-arms (and polls) on an alarm tick when instant but never armed", async () => {
    const spaceId = `wp-selfheal-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, {
      fetchDueWebhookSubscriptions: vi.fn(async () => []),
    });

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      // No WEBHOOK_POLL_KEY stored — e.g. DO storage predates Phase C.
      await inst.alarm();
      expect(await state.storage.get(WEBHOOK_POLL_KEY)).toBe(
        FIXED_NOW.getTime() + 900_000,
      );
      expect(await state.storage.getAlarm()).toBe(FIXED_NOW.getTime() + 900_000);
    });

    expect(deps.fetchDueWebhookSubscriptions).toHaveBeenCalledOnce();
  });
});
