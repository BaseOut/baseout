// SpaceDO scheduler — server-backup-scope (dual schema + data schedules,
// extends server-schedule-and-cancel Phase B).
//
// Surfaces:
//   - POST /set-frequency : parses { scope, dataFrequency, schemaFrequency }
//     (legacy { frequency } accepted), computes both next-fires, stores them,
//     arms the alarm for the nearer, returns { ok, dataNextFire, schemaNextFire }.
//   - alarm()             : reads stored fires + config, inserts a backup_runs
//     row per due kind (stamping kind), calls processRunStart, advances the
//     fired schedule(s), re-arms, and writes both next-scheduled columns.
//
// Pure dual-cadence math is covered by scheduling/dual-schedule.test.ts; this
// pins the DO wiring. Spy-injection via runInDurableObject (cloudflare:test).

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
// Far-future so workerd doesn't clamp setAlarm(pastTimestamp) — see the
// long-form note in the original Phase B test history.
const FIXED_NOW = new Date("2030-01-15T14:23:00.000Z");
const FIRES_KEY = "schedule_fires";

function depsFor(
  spaceId: string,
  overrides: Partial<SpaceDOAlarmDeps> = {},
): SpaceDOAlarmDeps {
  return {
    now: () => FIXED_NOW,
    fetchSpace: vi.fn(async () => ({ id: spaceId, organizationId: ORG_ID })),
    fetchActiveAirtableConnection: vi.fn(async () => ({
      id: CONN_ID,
      status: "active",
    })),
    fetchConfig: vi.fn(async () => ({
      id: CONFIG_ID,
      scope: "schema_and_data",
      dataFrequency: "daily",
      schemaFrequency: null,
    })),
    insertScheduledRun: vi.fn(async () => RUN_ID),
    deleteRun: vi.fn(async () => undefined),
    runStart: vi.fn(async () => ({ ok: true })),
    updateNextScheduled: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("SpaceDO POST /set-frequency", () => {
  it("computes the data next-fire and arms the alarm (legacy { frequency })", async () => {
    const spaceId = `set-freq-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(depsFor(spaceId));
      const res = await inst.fetch(
        new Request("http://do/set-frequency", {
          method: "POST",
          body: JSON.stringify({ spaceId, frequency: "daily" }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        ok: boolean;
        dataNextFire: number | null;
        schemaNextFire: number | null;
      };
      expect(body.ok).toBe(true);
      expect(body.dataNextFire).toBe(computeNextFire("daily", FIXED_NOW));
      expect(body.schemaNextFire).toBeNull();

      const scheduledFor = await state.storage.getAlarm();
      expect(scheduledFor).toBe(computeNextFire("daily", FIXED_NOW));
    });
  });

  it("arms the alarm for the nearer of two cadences (schema + data)", async () => {
    const spaceId = `dual-set-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(depsFor(spaceId));
      const res = await inst.fetch(
        new Request("http://do/set-frequency", {
          method: "POST",
          body: JSON.stringify({
            spaceId,
            scope: "schema_and_data",
            dataFrequency: "monthly",
            schemaFrequency: "daily",
          }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        dataNextFire: number;
        schemaNextFire: number;
      };
      expect(body.dataNextFire).toBe(computeNextFire("monthly", FIXED_NOW));
      expect(body.schemaNextFire).toBe(computeNextFire("daily", FIXED_NOW));
      // daily (schema) is nearer than monthly (data) → alarm = schema fire.
      const scheduledFor = await state.storage.getAlarm();
      expect(scheduledFor).toBe(computeNextFire("daily", FIXED_NOW));
    });
  });

  it("returns 400 for an unknown frequency", async () => {
    const stub = getStub(`bad-freq-${crypto.randomUUID()}`);
    const res = await stub.fetch("http://do/set-frequency", {
      method: "POST",
      body: JSON.stringify({ frequency: "hourly" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when frequency='instant' (out of scope this change)", async () => {
    const stub = getStub(`instant-${crypto.randomUUID()}`);
    const res = await stub.fetch("http://do/set-frequency", {
      method: "POST",
      body: JSON.stringify({ frequency: "instant" }),
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
  it("inserts a full scheduled run, calls runStart, advances + writes both next-scheduled cols", async () => {
    const spaceId = `alarm-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId);

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      await inst.alarm();
      const next = await state.storage.getAlarm();
      expect(next).toBe(computeNextFire("daily", FIXED_NOW));
    });

    expect(deps.fetchConfig).toHaveBeenCalledOnce();
    expect(deps.insertScheduledRun).toHaveBeenCalledWith({
      spaceId,
      connectionId: CONN_ID,
      kind: "full",
    });
    expect(deps.runStart).toHaveBeenCalledWith(RUN_ID);
    expect(deps.deleteRun).not.toHaveBeenCalled();
    expect(deps.updateNextScheduled).toHaveBeenCalledWith(CONFIG_ID, {
      dataNextFire: computeNextFire("daily", FIXED_NOW),
      schemaNextFire: null,
    });
  });

  it("fires BOTH kinds when both schedules are due at the tick", async () => {
    const spaceId = `dual-alarm-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, {
      fetchConfig: vi.fn(async () => ({
        id: CONFIG_ID,
        scope: "schema_and_data",
        dataFrequency: "monthly",
        schemaFrequency: "daily",
      })),
    });

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      // Seed both stored fires as already due.
      await state.storage.put(FIRES_KEY, {
        dataNextFire: FIXED_NOW.getTime() - 1000,
        schemaNextFire: FIXED_NOW.getTime() - 1000,
      });
      await inst.alarm();
    });

    expect(deps.insertScheduledRun).toHaveBeenCalledTimes(2);
    expect(deps.insertScheduledRun).toHaveBeenCalledWith({
      spaceId,
      connectionId: CONN_ID,
      kind: "full",
    });
    expect(deps.insertScheduledRun).toHaveBeenCalledWith({
      spaceId,
      connectionId: CONN_ID,
      kind: "schema",
    });
  });
});

describe("SpaceDO alarm() — error gates", () => {
  it("returns without scheduling when the config is missing", async () => {
    const spaceId = `no-config-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, { fetchConfig: vi.fn(async () => null) });

    await runInDurableObject(stub, async (inst) => {
      inst.setSchedulerDepsForTests(deps);
      await inst.alarm();
    });

    expect(deps.insertScheduledRun).not.toHaveBeenCalled();
    expect(deps.updateNextScheduled).not.toHaveBeenCalled();
    await runInDurableObject(stub, async (_inst, state) => {
      expect(await state.storage.getAlarm()).toBeNull();
    });
  });

  it("does not fire and clears the alarm when the data cadence is instant", async () => {
    const spaceId = `instant-alarm-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, {
      fetchConfig: vi.fn(async () => ({
        id: CONFIG_ID,
        scope: "schema_and_data",
        dataFrequency: "instant",
        schemaFrequency: null,
      })),
    });

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      await inst.alarm();
      expect(await state.storage.getAlarm()).toBeNull();
    });

    expect(deps.insertScheduledRun).not.toHaveBeenCalled();
  });

  it("reschedules but skips the fire when no active Airtable connection exists", async () => {
    const spaceId = `no-conn-${crypto.randomUUID()}`;
    const stub = getStub(spaceId);
    const deps = depsFor(spaceId, {
      fetchActiveAirtableConnection: vi.fn(async () => null),
    });

    await runInDurableObject(stub, async (inst, state) => {
      inst.setSchedulerDepsForTests(deps);
      await inst.alarm();
      expect(await state.storage.getAlarm()).toBe(
        computeNextFire("daily", FIXED_NOW),
      );
    });

    expect(deps.insertScheduledRun).not.toHaveBeenCalled();
    expect(deps.runStart).not.toHaveBeenCalled();
    expect(deps.updateNextScheduled).toHaveBeenCalledWith(CONFIG_ID, {
      dataNextFire: computeNextFire("daily", FIXED_NOW),
      schemaNextFire: null,
    });
  });

  it("rolls back the inserted run when runStart fails", async () => {
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
    expect(deps.updateNextScheduled).toHaveBeenCalledWith(CONFIG_ID, {
      dataNextFire: computeNextFire("daily", FIXED_NOW),
      schemaNextFire: null,
    });
  });
});
