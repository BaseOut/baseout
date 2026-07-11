// Pure-logic tests for deriveInboxItems (server-notifications-inbox). No DB —
// the derivation takes already-fetched source rows (runs / connections / schema
// updates / triage state / mutes) and produces the web-`InboxItem`-shaped feed.
// Placed under tests/integration/** so the server test runner picks it up
// (it only includes that glob), though it touches no bindings — the same
// convention as per-space/relationships.test.ts.

import { describe, expect, it } from "vitest";
import {
  deriveInboxItems,
  INBOX_FEED_CAP,
  type ConnectionSourceRow,
  type DeriveInboxInput,
  type RunSourceRow,
  type SchemaUpdateSourceRow,
} from "../../../src/lib/notifications/derive";

const NOW = new Date("2026-07-10T12:00:00.000Z");

function input(over?: Partial<DeriveInboxInput>): DeriveInboxInput {
  return { runs: [], connections: [], schemaUpdates: [], states: [], mutes: [], now: NOW, ...over };
}

function run(over?: Partial<RunSourceRow>): RunSourceRow {
  return {
    runId: "22222222-2222-2222-2222-222222222222",
    status: "succeeded",
    baseId: "appCRM",
    baseName: "Core CRM",
    baseCount: 1,
    errorMessage: null,
    at: "2026-07-09T10:00:00.000Z",
    ...over,
  };
}

function conn(over?: Partial<ConnectionSourceRow>): ConnectionSourceRow {
  return {
    connectionId: "conn-1",
    displayName: "Main Airtable Account",
    status: "invalid",
    at: "2026-07-08T09:00:00.000Z",
    ...over,
  };
}

function schemaUpdate(over?: Partial<SchemaUpdateSourceRow>): SchemaUpdateSourceRow {
  return {
    updateId: "33333333-3333-3333-3333-333333333333",
    baseId: "appCRM",
    baseName: "Core CRM",
    entityType: "field",
    changeType: "type",
    changeTypeName: "Field type",
    breaksData: false,
    at: "2026-07-07T08:00:00.000Z",
    ...over,
  };
}

describe("deriveInboxItems — kind mapping + ids", () => {
  it("returns an empty feed for no sources", () => {
    expect(deriveInboxItems(input())).toEqual([]);
  });

  it("maps a failed run to backup-failed with a run: id and deep-link", () => {
    const items = deriveInboxItems(
      input({ runs: [run({ status: "failed", errorMessage: "boom" })] }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "run:22222222-2222-2222-2222-222222222222",
      kind: "backup-failed",
      title: "*Core CRM* backup failed",
      detail: "boom",
      base: "Core CRM",
      at: "2026-07-09T10:00:00.000Z",
      href: "/backups/runs/22222222-2222-2222-2222-222222222222",
    });
    expect(items[0]!.stateBacked).toBeUndefined();
    expect(items[0]!.action).toBeUndefined();
  });

  it("maps a succeeded run to backup-ok (activity)", () => {
    const items = deriveInboxItems(input({ runs: [run()] }));
    expect(items[0]).toMatchObject({
      id: "run:22222222-2222-2222-2222-222222222222",
      kind: "backup-ok",
      title: "*Core CRM* backed up",
      base: "Core CRM",
      href: "/backups/runs/22222222-2222-2222-2222-222222222222",
    });
  });

  it("emits baseId on per-base rows — the web mute key", () => {
    const items = deriveInboxItems(
      input({
        runs: [run()],
        schemaUpdates: [schemaUpdate()],
      }),
    );
    for (const item of items) {
      expect(item.baseId, `${item.id} must carry baseId`).toBeTruthy();
    }
  });

  it("ignores runs in non-terminal / other statuses", () => {
    const items = deriveInboxItems(
      input({
        runs: [
          run({ status: "running" }),
          run({ status: "queued" }),
          run({ status: "cancelled" }),
        ],
      }),
    );
    expect(items).toEqual([]);
  });

  it("titles a multi-base run without a single base and omits base", () => {
    const items = deriveInboxItems(
      input({ runs: [run({ baseId: null, baseName: null, baseCount: 3 })] }),
    );
    expect(items[0]!.title).toBe("3 bases backed up");
    expect(items[0]!.base).toBeUndefined();
  });

  it("maps a broken connection to a state-backed connection-broken row with the Reconnect action", () => {
    const items = deriveInboxItems(input({ connections: [conn()] }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "conn:conn-1",
      kind: "connection-broken",
      title: "*Main Airtable Account* connection needs reconnecting",
      at: "2026-07-08T09:00:00.000Z",
      href: "/integrations",
      stateBacked: true,
      action: {
        label: "Reconnect",
        href: "/integrations",
        icon: "lucide--refresh-cw",
        primary: true,
      },
    });
  });

  it("falls back to the platform name when a connection has no display name", () => {
    const items = deriveInboxItems(input({ connections: [conn({ displayName: null })] }));
    expect(items[0]!.title).toBe("*Airtable* connection needs reconnecting");
  });

  it("splits schema updates into schema-breaking / schema-changed by breaksData", () => {
    const items = deriveInboxItems(
      input({
        schemaUpdates: [
          schemaUpdate({ updateId: "u-breaking", breaksData: true, at: "2026-07-07T09:00:00.000Z" }),
          schemaUpdate({ updateId: "u-benign", breaksData: false, at: "2026-07-07T08:00:00.000Z" }),
        ],
      }),
    );
    expect(items.map((i) => [i.id, i.kind])).toEqual([
      ["schema:u-breaking", "schema-breaking"],
      ["schema:u-benign", "schema-changed"],
    ]);
    expect(items[0]).toMatchObject({
      title: "Breaking schema change in *Core CRM*",
      detail: "Field type",
      base: "Core CRM",
      href: "/schema?tab=changelog",
    });
    expect(items[1]!.title).toBe("Schema changed in *Core CRM*");
  });

  it("never emits a `space` field (web adds it)", () => {
    const items = deriveInboxItems(
      input({ runs: [run()], connections: [conn()], schemaUpdates: [schemaUpdate()] }),
    );
    for (const item of items) {
      expect("space" in item).toBe(false);
    }
  });
});

describe("deriveInboxItems — triage-state merge", () => {
  it("merges read/done/snoozedUntil from the state rows onto matching items", () => {
    const items = deriveInboxItems(
      input({
        runs: [run({ status: "failed" })],
        states: [
          {
            itemId: "run:22222222-2222-2222-2222-222222222222",
            read: true,
            done: true,
            snoozedUntil: null,
          },
        ],
      }),
    );
    expect(items[0]).toMatchObject({ read: true, done: true, snoozedUntil: null });
  });

  it("keeps future-snoozed items in the feed (web handles display) — snooze round-trips", () => {
    const future = "2026-08-01T00:00:00.000Z";
    const items = deriveInboxItems(
      input({
        runs: [run({ status: "failed" })],
        states: [
          {
            itemId: "run:22222222-2222-2222-2222-222222222222",
            read: false,
            done: false,
            snoozedUntil: future,
          },
        ],
      }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]!.snoozedUntil).toBe(future);
  });

  it("leaves triage fields unset on untouched items", () => {
    const items = deriveInboxItems(input({ runs: [run()] }));
    expect(items[0]!.read).toBeUndefined();
    expect(items[0]!.done).toBeUndefined();
    expect(items[0]!.snoozedUntil).toBeUndefined();
  });
});

describe("deriveInboxItems — mutes", () => {
  const muted = [{ baseId: "appCRM" }];

  it("drops activity-lane rows (backup-ok, schema-changed) for muted bases", () => {
    const items = deriveInboxItems(
      input({
        runs: [run()],
        schemaUpdates: [schemaUpdate({ breaksData: false })],
        mutes: muted,
      }),
    );
    expect(items).toEqual([]);
  });

  it("keeps attention-lane rows (backup-failed, schema-breaking) for muted bases", () => {
    const items = deriveInboxItems(
      input({
        runs: [run({ status: "failed" })],
        schemaUpdates: [schemaUpdate({ updateId: "u-breaking", breaksData: true })],
        mutes: muted,
      }),
    );
    expect(items.map((i) => i.kind).sort()).toEqual(["backup-failed", "schema-breaking"]);
  });

  it("does not drop activity rows for other bases", () => {
    const items = deriveInboxItems(
      input({ runs: [run({ baseId: "appOther", baseName: "Ops" })], mutes: muted }),
    );
    expect(items).toHaveLength(1);
  });
});

describe("deriveInboxItems — ordering + cap", () => {
  it("sorts the merged feed newest-first across kinds", () => {
    const items = deriveInboxItems(
      input({
        runs: [run({ at: "2026-07-05T00:00:00.000Z" })],
        connections: [conn({ at: "2026-07-09T00:00:00.000Z" })],
        schemaUpdates: [schemaUpdate({ at: "2026-07-07T00:00:00.000Z" })],
      }),
    );
    expect(items.map((i) => i.kind)).toEqual(["connection-broken", "schema-changed", "backup-ok"]);
  });

  it(`caps the feed at ${INBOX_FEED_CAP} items`, () => {
    const runs = Array.from({ length: INBOX_FEED_CAP + 20 }, (_, i) =>
      run({ runId: `run-${i}`, at: new Date(Date.UTC(2026, 6, 1, 0, i)).toISOString() }),
    );
    const items = deriveInboxItems(input({ runs }));
    expect(items).toHaveLength(INBOX_FEED_CAP);
    // newest survive the cap
    expect(items[0]!.id).toBe(`run:run-${INBOX_FEED_CAP + 19}`);
  });
});
