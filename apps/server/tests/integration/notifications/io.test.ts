// Orchestration + triage-decision tests for the notifications IO module
// (server-notifications-inbox). Pure — the loaders are injected fakes (the
// real drizzle loaders need a provisioned managed_pg Space, which the test
// pool doesn't have; same stance as describe-schema-io.test.ts). Placed under
// tests/integration/** so the server test runner picks it up.

import { describe, expect, it } from "vitest";
import {
  loadInboxFeed,
  triagePatch,
  InvalidTriageError,
  StateBackedDoneError,
  type InboxFeedSourcesMaster,
  type InboxFeedSourcesSpace,
} from "../../../src/lib/notifications/io";

const NOW = new Date("2026-07-10T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const masterSources = (over?: Partial<InboxFeedSourcesMaster>): InboxFeedSourcesMaster => ({
  runs: [
    {
      runId: "run-fail",
      status: "failed",
      baseId: "appCRM",
      baseName: "Core CRM",
      baseCount: 1,
      errorMessage: "quota",
      at: "2026-07-09T10:00:00.000Z",
    },
    {
      runId: "run-ok",
      status: "succeeded",
      baseId: "appCRM",
      baseName: "Core CRM",
      baseCount: 1,
      at: "2026-07-08T10:00:00.000Z",
    },
  ],
  connections: [
    { connectionId: "c1", displayName: "Main", status: "invalid", at: "2026-07-07T10:00:00.000Z" },
  ],
  ...over,
});

const spaceSources = (over?: Partial<InboxFeedSourcesSpace>): InboxFeedSourcesSpace => ({
  schemaUpdates: [
    {
      updateId: "u1",
      baseId: "appCRM",
      baseName: "Core CRM",
      entityType: "field",
      changeType: "type",
      changeTypeName: "Field type",
      breaksData: true,
      at: "2026-07-06T10:00:00.000Z",
    },
  ],
  states: [],
  mutes: [],
  ...over,
});

describe("loadInboxFeed", () => {
  it("loads both source halves with the 30-day window and derives the merged feed", async () => {
    const sinces: Date[] = [];
    const items = await loadInboxFeed({
      now: NOW,
      loadMasterSources: async (since) => {
        sinces.push(since);
        return masterSources();
      },
      loadSpaceSources: async (since) => {
        sinces.push(since);
        return spaceSources();
      },
    });

    expect(sinces).toHaveLength(2);
    for (const since of sinces) {
      expect(NOW.getTime() - since.getTime()).toBe(30 * DAY);
    }
    expect(items.map((i) => i.id)).toEqual(["run:run-fail", "run:run-ok", "conn:c1", "schema:u1"]);
    expect(items.map((i) => i.kind)).toEqual([
      "backup-failed",
      "backup-ok",
      "connection-broken",
      "schema-breaking",
    ]);
  });

  it("merges triage state and mutes from the space half", async () => {
    const items = await loadInboxFeed({
      now: NOW,
      loadMasterSources: async () => masterSources(),
      loadSpaceSources: async () =>
        spaceSources({
          states: [{ itemId: "run:run-fail", read: true, done: false, snoozedUntil: null }],
          mutes: [{ baseId: "appCRM" }],
        }),
    });
    // backup-ok (activity) muted away; attention rows survive
    expect(items.map((i) => i.id)).toEqual(["run:run-fail", "conn:c1", "schema:u1"]);
    expect(items[0]).toMatchObject({ read: true, done: false });
  });
});

describe("triagePatch", () => {
  it("maps each action to an idempotent absolute patch", () => {
    expect(triagePatch("run:r1", "read")).toEqual({ read: true });
    expect(triagePatch("run:r1", "unread")).toEqual({ read: false });
    expect(triagePatch("run:r1", "done")).toEqual({ done: true });
    expect(triagePatch("run:r1", "undone")).toEqual({ done: false });
    expect(triagePatch("run:r1", "snooze", "2026-08-01T00:00:00.000Z")).toEqual({
      snoozedUntil: new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(triagePatch("run:r1", "unsnooze")).toEqual({ snoozedUntil: null });
  });

  it("is idempotent — the same command yields the same patch every time", () => {
    expect(triagePatch("schema:u1", "done")).toEqual(triagePatch("schema:u1", "done"));
    expect(triagePatch("run:r1", "snooze", "2026-08-01T00:00:00.000Z")).toEqual(
      triagePatch("run:r1", "snooze", "2026-08-01T00:00:00.000Z"),
    );
  });

  it("rejects done on a state-backed id (conn:*) with the typed 422 error", () => {
    expect(() => triagePatch("conn:c1", "done")).toThrow(StateBackedDoneError);
    // …but every other triage action stays legal on conn:* rows
    expect(triagePatch("conn:c1", "read")).toEqual({ read: true });
    expect(triagePatch("conn:c1", "snooze", "2026-08-01T00:00:00.000Z")).toEqual({
      snoozedUntil: new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(triagePatch("conn:c1", "undone")).toEqual({ done: false });
  });

  it("rejects snooze without a parseable snoozedUntil", () => {
    expect(() => triagePatch("run:r1", "snooze")).toThrow(InvalidTriageError);
    expect(() => triagePatch("run:r1", "snooze", "not-a-date")).toThrow(InvalidTriageError);
  });

  it("rejects unknown actions and empty item ids", () => {
    expect(() => triagePatch("run:r1", "frobnicate")).toThrow(InvalidTriageError);
    expect(() => triagePatch("", "read")).toThrow(InvalidTriageError);
  });
});
