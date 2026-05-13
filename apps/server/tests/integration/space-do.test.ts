// SpaceDO scheduler — Phase B of baseout-backup-schedule-and-cancel.
//
// Two surfaces:
//   - POST /set-frequency : computes the next-fire timestamp via
//     computeNextFire(frequency, now), calls state.storage.setAlarm(),
//     returns { ok: true, nextFireMs }.
//   - alarm()             : fetches the Space's config, INSERTs a
//     'queued' backup_runs row with triggered_by='scheduled', calls
//     processRunStart, then recomputes + re-sets the alarm and writes
//     backup_configurations.next_scheduled_at.
//
// Spy-injection uses `runInDurableObject` from cloudflare:test — same
// pattern as connection-do-token-cache.test.ts.

import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import type { SpaceDO } from "../../src/durable-objects/SpaceDO";
import type { SpaceDOAlarmDeps } from "../../src/durable-objects/SpaceDO";
import { computeNextFire } from "../../src/lib/scheduling/next-fire";

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
const FIXED_NOW = new Date("2026-05-12T14:23:00.000Z");

// The DO addresses itself by `state.id.name` (set by idFromName(spaceId)).
// Each test threads its DO-name through deps as the spaceId so assertions
// match what the production path would see.
function depsFor(
  spaceId: string,
  overrides: Partial<SpaceDOAlarmDeps> = {},
): SpaceDOAlarmDeps {
  return {
    now: () => FIXED_NOW,
    fetchSpace: vi.fn(async () => ({
      id: spaceId,
      organizationId: ORG_ID,
    })),
    fetchActiveAirtableConnection: vi.fn(async () => ({
      id: CONN_ID,
      status: "active",
    })),
    fetchConfig: vi.fn(async () => ({
      id: CONFIG_ID,
      frequency: "daily",
    })),
    insertScheduledRun: vi.fn(async () => RUN_ID),
    deleteRun: vi.fn(async () => undefined),
    runStart: vi.fn(async () => ({ ok: true })),
    updateNextScheduledAt: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("SpaceDO POST /set-frequency", () => {
  it("computes next-fire via computeNextFire and calls state.storage.setAlarm", async () => {
    const spaceId = `set-freq-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);

    await runInDurableObject(stub, async (inst) => {
      inst.setSchedulerDepsForTests(depsFor(spaceId));
    });

    const res = await stub.fetch("http://do/set-frequency", {
      method: "POST",
      body: JSON.stringify({ spaceId, frequency: "daily" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; nextFireMs: number };
    expect(body.ok).toBe(true);
    expect(body.nextFireMs).toBe(computeNextFire("daily", FIXED_NOW));

    await runInDurableObject(stub, async (_inst, state) => {
      const scheduledFor = await state.storage.getAlarm();
      expect(scheduledFor).toBe(computeNextFire("daily", FIXED_NOW));
    });
  });

  it("returns 400 for an unknown frequency", async () => {
    const spaceId = `bad-freq-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    await runInDurableObject(stub, async (inst) => {
      inst.setSchedulerDepsForTests(depsFor(spaceId));
    });
    const res = await stub.fetch("http://do/set-frequency", {
      method: "POST",
      body: JSON.stringify({ spaceId, frequency: "hourly" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when frequency='instant' (out of scope this change)", async () => {
    const spaceId = `instant-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    await runInDurableObject(stub, async (inst) => {
      inst.setSchedulerDepsForTests(depsFor(spaceId));
    });
    const res = await stub.fetch("http://do/set-frequency", {
      method: "POST",
      body: JSON.stringify({ spaceId, frequency: "instant" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 405 on non-POST", async () => {
    const stub = getStub(`get-${crypto.randomUUID()}`);
    const res = await stub.fetch("http://do/set-frequency", { method: "GET" });
    expect(res.status).toBe(405);
  });
});

describe("SpaceDO alarm() — happy path", () => {
  it("inserts a scheduled run, calls runStart, recomputes alarm, writes next_scheduled_at", async () => {
    const spaceId = `alarm-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId);

    await runInDurableObject(stub, async (inst) => {
      inst.setSchedulerDepsForTests(deps);
      await inst.alarm();
    });

    expect(deps.fetchConfig).toHaveBeenCalledOnce();
    expect(deps.fetchSpace).toHaveBeenCalledOnce();
    expect(deps.fetchActiveAirtableConnection).toHaveBeenCalledWith(ORG_ID);
    expect(deps.insertScheduledRun).toHaveBeenCalledWith({
      spaceId,
      connectionId: CONN_ID,
    });
    expect(deps.runStart).toHaveBeenCalledWith(RUN_ID);
    expect(deps.deleteRun).not.toHaveBeenCalled();
    expect(deps.updateNextScheduledAt).toHaveBeenCalledWith(
      CONFIG_ID,
      computeNextFire("daily", FIXED_NOW),
    );

    // Re-sets the alarm so the next fire happens on schedule.
    await runInDurableObject(stub, async (_inst, state) => {
      const next = await state.storage.getAlarm();
      expect(next).toBe(computeNextFire("daily", FIXED_NOW));
    });
  });
});

describe("SpaceDO alarm() — error gates", () => {
  it("returns without scheduling when the config is missing", async () => {
    const spaceId = `no-config-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, {
      fetchConfig: vi.fn(async () => null),
    });

    await runInDurableObject(stub, async (inst) => {
      inst.setSchedulerDepsForTests(deps);
      await inst.alarm();
    });

    expect(deps.insertScheduledRun).not.toHaveBeenCalled();
    expect(deps.runStart).not.toHaveBeenCalled();
    expect(deps.updateNextScheduledAt).not.toHaveBeenCalled();
    // No alarm rescheduled when config is gone (the Space's config was
    // deleted — there's nothing to keep firing for).
    await runInDurableObject(stub, async (_inst, state) => {
      const next = await state.storage.getAlarm();
      expect(next).toBeNull();
    });
  });

  it("returns without scheduling when frequency='instant'", async () => {
    // Instant is webhook-driven; the alarm path is not the right
    // dispatcher. Same no-op rule as missing-config.
    const spaceId = `instant-alarm-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, {
      fetchConfig: vi.fn(async () => ({
        id: CONFIG_ID,
        frequency: "instant",
      })),
    });

    await runInDurableObject(stub, async (inst) => {
      inst.setSchedulerDepsForTests(deps);
      await inst.alarm();
    });

    expect(deps.insertScheduledRun).not.toHaveBeenCalled();
    expect(deps.updateNextScheduledAt).not.toHaveBeenCalled();
  });

  it("reschedules but skips the fire when no active Airtable connection exists", async () => {
    // Per design.md: empty-connection cases log + reschedule. Otherwise
    // a Space without bases (or with a stale connection) silently
    // disables itself — not what the user wants.
    const spaceId = `no-conn-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, {
      fetchActiveAirtableConnection: vi.fn(async () => null),
    });

    await runInDurableObject(stub, async (inst) => {
      inst.setSchedulerDepsForTests(deps);
      await inst.alarm();
    });

    expect(deps.insertScheduledRun).not.toHaveBeenCalled();
    expect(deps.runStart).not.toHaveBeenCalled();
    // Reschedules.
    expect(deps.updateNextScheduledAt).toHaveBeenCalledWith(
      CONFIG_ID,
      computeNextFire("daily", FIXED_NOW),
    );
    await runInDurableObject(stub, async (_inst, state) => {
      const next = await state.storage.getAlarm();
      expect(next).toBe(computeNextFire("daily", FIXED_NOW));
    });
  });

  it("rolls back the inserted run when runStart fails (e.g. no_bases_selected)", async () => {
    // Same shape as the apps/web POST /backup-runs route's failure
    // path — the queued row is deleted so it doesn't linger.
    const spaceId = `rollback-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, {
      runStart: vi.fn(async () => ({ ok: false, code: "no_bases_selected" })),
    });

    await runInDurableObject(stub, async (inst) => {
      inst.setSchedulerDepsForTests(deps);
      await inst.alarm();
    });

    expect(deps.insertScheduledRun).toHaveBeenCalledOnce();
    expect(deps.deleteRun).toHaveBeenCalledWith(RUN_ID);

    // Schedule still moves forward — we don't want a failed fire to
    // silently disable the schedule.
    expect(deps.updateNextScheduledAt).toHaveBeenCalledWith(
      CONFIG_ID,
      computeNextFire("daily", FIXED_NOW),
    );
  });
});
