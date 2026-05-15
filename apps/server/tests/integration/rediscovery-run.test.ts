// Pure-function tests for the workspace-rediscovery orchestration.
//
// runWorkspaceRediscovery() lists bases from Airtable, upserts at_bases,
// and — when the per-config auto_add_future_bases toggle is on — includes
// freshly-discovered bases in the next backup run up to the tier
// `basesPerSpace` cap. Every effect is a deps function (DB, Airtable, log,
// clock) so tests cover all branches via vi.fn() without touching a real
// Postgres or Airtable.
//
// Coverage targets the cases the alarm + manual-rescan paths share:
//   - no fresh bases               → no auto-add, no event
//   - toggle off                   → discovered-only event, no auto-add
//   - toggle on within cap         → all fresh bases auto-added
//   - toggle on over cap (split)   → fits-cap auto-added; rest blockedByTier
//   - null cap (enterprise)        → all fresh bases auto-added
//   - Airtable listBases throws    → no DB writes, error surfaces
//
// The route- and alarm-level integration (Phase 3 + Phase 4) layer their
// own tests on top using these deps wired to production I/O.

import { describe, expect, it, vi } from "vitest";
import {
  runWorkspaceRediscovery,
  type WorkspaceRediscoveryDeps,
} from "../../src/lib/rediscovery/run";

const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const CONFIG_ID = "22222222-2222-2222-2222-222222222222";
const ORG_ID = "33333333-3333-3333-3333-333333333333";
const NOW = new Date("2026-05-14T18:00:00.000Z");

interface DepsBag {
  fetchKnownAtBaseIds: ReturnType<typeof vi.fn>;
  fetchAutoAddToggle: ReturnType<typeof vi.fn>;
  fetchIncludedBaseCount: ReturnType<typeof vi.fn>;
  listAirtableBases: ReturnType<typeof vi.fn>;
  upsertAtBases: ReturnType<typeof vi.fn>;
  resolveTierCap: ReturnType<typeof vi.fn>;
  enableBackupConfigurationBases: ReturnType<typeof vi.fn>;
  insertSpaceEvent: ReturnType<typeof vi.fn>;
  now: ReturnType<typeof vi.fn>;
  logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
}

function makeDeps(): DepsBag {
  return {
    fetchKnownAtBaseIds: vi.fn(async () => new Set<string>()),
    fetchAutoAddToggle: vi.fn(async () => false),
    fetchIncludedBaseCount: vi.fn(async () => 0),
    listAirtableBases: vi.fn(async () => []),
    upsertAtBases: vi.fn(async () => {}),
    resolveTierCap: vi.fn(async () => 5),
    enableBackupConfigurationBases: vi.fn(async () => {}),
    insertSpaceEvent: vi.fn(async () => {}),
    now: vi.fn(() => NOW),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

function asDeps(bag: DepsBag): WorkspaceRediscoveryDeps {
  return bag as unknown as WorkspaceRediscoveryDeps;
}

const baseInput = {
  spaceId: SPACE_ID,
  configId: CONFIG_ID,
  organizationId: ORG_ID,
  triggeredBy: "manual" as const,
};

describe("runWorkspaceRediscovery — no fresh bases", () => {
  it("returns zeros, upserts existing listing for last_seen_at bump, no event", async () => {
    const deps = makeDeps();
    deps.fetchKnownAtBaseIds.mockResolvedValueOnce(
      new Set(["appAAA", "appBBB"]),
    );
    deps.listAirtableBases.mockResolvedValueOnce([
      { id: "appAAA", name: "Tasks", permissionLevel: "create" },
      { id: "appBBB", name: "Projects", permissionLevel: "read" },
    ]);

    const result = await runWorkspaceRediscovery(baseInput, asDeps(deps));

    expect(result).toEqual({ discovered: 0, autoAdded: 0, blockedByTier: 0 });
    // Still upsert so last_seen_at bumps for known bases.
    expect(deps.upsertAtBases).toHaveBeenCalledOnce();
    expect(deps.enableBackupConfigurationBases).not.toHaveBeenCalled();
    expect(deps.insertSpaceEvent).not.toHaveBeenCalled();
  });
});

describe("runWorkspaceRediscovery — auto-add toggle off", () => {
  it("emits discovered-only event, never includes fresh bases", async () => {
    const deps = makeDeps();
    deps.fetchAutoAddToggle.mockResolvedValueOnce(false);
    deps.fetchKnownAtBaseIds.mockResolvedValueOnce(new Set(["appAAA"]));
    deps.listAirtableBases.mockResolvedValueOnce([
      { id: "appAAA", name: "Tasks", permissionLevel: "create" },
      { id: "appNEW1", name: "Inventory", permissionLevel: "create" },
      { id: "appNEW2", name: "Vendors", permissionLevel: "read" },
    ]);

    const result = await runWorkspaceRediscovery(baseInput, asDeps(deps));

    expect(result).toEqual({ discovered: 2, autoAdded: 0, blockedByTier: 0 });
    expect(deps.enableBackupConfigurationBases).not.toHaveBeenCalled();
    expect(deps.insertSpaceEvent).toHaveBeenCalledOnce();
    const payload = deps.insertSpaceEvent.mock.calls[0]![1];
    expect(payload).toEqual({
      kind: "bases_discovered",
      payload: {
        discovered: ["appNEW1", "appNEW2"],
        autoAdded: [],
        blockedByTier: [],
        tierCap: 5,
      },
    });
    // resolveTierCap is still invoked so the payload carries `tierCap`
    // for the inline banner ("Your tier allows N — upgrade for auto-add.")
    // without a follow-up round trip from the UI.
    expect(deps.resolveTierCap).toHaveBeenCalledOnce();
  });
});

describe("runWorkspaceRediscovery — auto-add on, within cap", () => {
  it("auto-adds every fresh base, emits event with autoAdded list", async () => {
    const deps = makeDeps();
    deps.fetchAutoAddToggle.mockResolvedValueOnce(true);
    deps.fetchKnownAtBaseIds.mockResolvedValueOnce(new Set(["appAAA"]));
    deps.fetchIncludedBaseCount.mockResolvedValueOnce(1);
    deps.resolveTierCap.mockResolvedValueOnce(5);
    deps.listAirtableBases.mockResolvedValueOnce([
      { id: "appAAA", name: "Tasks", permissionLevel: "create" },
      { id: "appNEW1", name: "Inventory", permissionLevel: "create" },
      { id: "appNEW2", name: "Vendors", permissionLevel: "create" },
    ]);

    const result = await runWorkspaceRediscovery(baseInput, asDeps(deps));

    expect(result).toEqual({ discovered: 2, autoAdded: 2, blockedByTier: 0 });
    expect(deps.enableBackupConfigurationBases).toHaveBeenCalledOnce();
    const [configId, atBaseIds] =
      deps.enableBackupConfigurationBases.mock.calls[0]!;
    expect(configId).toBe(CONFIG_ID);
    expect(atBaseIds).toEqual(["appNEW1", "appNEW2"]);

    const eventArgs = deps.insertSpaceEvent.mock.calls[0]![1];
    expect(eventArgs.payload).toEqual({
      discovered: ["appNEW1", "appNEW2"],
      autoAdded: ["appNEW1", "appNEW2"],
      blockedByTier: [],
      tierCap: 5,
    });
  });
});

describe("runWorkspaceRediscovery — auto-add on, over cap (split)", () => {
  it("auto-adds up to the remaining cap; rest go to blockedByTier", async () => {
    const deps = makeDeps();
    deps.fetchAutoAddToggle.mockResolvedValueOnce(true);
    deps.fetchKnownAtBaseIds.mockResolvedValueOnce(new Set(["appAAA"]));
    deps.fetchIncludedBaseCount.mockResolvedValueOnce(3); // 3 included / cap 5
    deps.resolveTierCap.mockResolvedValueOnce(5);
    deps.listAirtableBases.mockResolvedValueOnce([
      { id: "appAAA", name: "Tasks", permissionLevel: "create" },
      { id: "appNEW1", name: "Inventory", permissionLevel: "create" },
      { id: "appNEW2", name: "Vendors", permissionLevel: "create" },
      { id: "appNEW3", name: "Audit", permissionLevel: "read" },
      { id: "appNEW4", name: "Archive", permissionLevel: "read" },
    ]);

    const result = await runWorkspaceRediscovery(baseInput, asDeps(deps));

    // 5 cap − 3 already-included = 2 remaining slots; 4 fresh → 2 add / 2 block
    expect(result).toEqual({ discovered: 4, autoAdded: 2, blockedByTier: 2 });
    const [, atBaseIds] =
      deps.enableBackupConfigurationBases.mock.calls[0]!;
    expect(atBaseIds).toEqual(["appNEW1", "appNEW2"]);

    const eventArgs = deps.insertSpaceEvent.mock.calls[0]![1];
    expect(eventArgs.payload).toEqual({
      discovered: ["appNEW1", "appNEW2", "appNEW3", "appNEW4"],
      autoAdded: ["appNEW1", "appNEW2"],
      blockedByTier: ["appNEW3", "appNEW4"],
      tierCap: 5,
    });
  });

  it("auto-adds nothing when already at or above cap; everything is blocked", async () => {
    const deps = makeDeps();
    deps.fetchAutoAddToggle.mockResolvedValueOnce(true);
    deps.fetchKnownAtBaseIds.mockResolvedValueOnce(new Set());
    deps.fetchIncludedBaseCount.mockResolvedValueOnce(5);
    deps.resolveTierCap.mockResolvedValueOnce(5);
    deps.listAirtableBases.mockResolvedValueOnce([
      { id: "appNEW1", name: "A", permissionLevel: "read" },
      { id: "appNEW2", name: "B", permissionLevel: "read" },
    ]);

    const result = await runWorkspaceRediscovery(baseInput, asDeps(deps));

    expect(result).toEqual({ discovered: 2, autoAdded: 0, blockedByTier: 2 });
    expect(deps.enableBackupConfigurationBases).not.toHaveBeenCalled();
  });
});

describe("runWorkspaceRediscovery — null cap (enterprise)", () => {
  it("auto-adds every fresh base when tier cap is null", async () => {
    const deps = makeDeps();
    deps.fetchAutoAddToggle.mockResolvedValueOnce(true);
    deps.fetchKnownAtBaseIds.mockResolvedValueOnce(new Set());
    deps.fetchIncludedBaseCount.mockResolvedValueOnce(99);
    deps.resolveTierCap.mockResolvedValueOnce(null);
    deps.listAirtableBases.mockResolvedValueOnce([
      { id: "appNEW1", name: "A", permissionLevel: "read" },
      { id: "appNEW2", name: "B", permissionLevel: "read" },
      { id: "appNEW3", name: "C", permissionLevel: "read" },
    ]);

    const result = await runWorkspaceRediscovery(baseInput, asDeps(deps));

    expect(result).toEqual({ discovered: 3, autoAdded: 3, blockedByTier: 0 });
    const eventArgs = deps.insertSpaceEvent.mock.calls[0]![1];
    expect(eventArgs.payload.tierCap).toBeNull();
  });
});

describe("runWorkspaceRediscovery — Airtable failure", () => {
  it("propagates listBases errors and writes nothing to the DB", async () => {
    const deps = makeDeps();
    deps.listAirtableBases.mockRejectedValueOnce(new Error("airtable 503"));

    await expect(
      runWorkspaceRediscovery(baseInput, asDeps(deps)),
    ).rejects.toThrow("airtable 503");

    expect(deps.upsertAtBases).not.toHaveBeenCalled();
    expect(deps.enableBackupConfigurationBases).not.toHaveBeenCalled();
    expect(deps.insertSpaceEvent).not.toHaveBeenCalled();
  });
});

describe("runWorkspaceRediscovery — triggeredBy is passed to upsertAtBases", () => {
  it("upserts with the correct discoveredVia for alarm runs", async () => {
    const deps = makeDeps();
    deps.fetchKnownAtBaseIds.mockResolvedValueOnce(new Set());
    deps.listAirtableBases.mockResolvedValueOnce([
      { id: "appNEW1", name: "A", permissionLevel: "read" },
    ]);

    await runWorkspaceRediscovery(
      { ...baseInput, triggeredBy: "alarm" },
      asDeps(deps),
    );

    const [rows, opts] = deps.upsertAtBases.mock.calls[0]!;
    expect(rows).toEqual([
      { atBaseId: "appNEW1", name: "A" },
    ]);
    expect(opts).toEqual({
      spaceId: SPACE_ID,
      discoveredViaForFreshInserts: "rediscovery_scheduled",
      now: NOW,
    });
  });

  it("upserts with the correct discoveredVia for manual rescans", async () => {
    const deps = makeDeps();
    deps.fetchKnownAtBaseIds.mockResolvedValueOnce(new Set());
    deps.listAirtableBases.mockResolvedValueOnce([
      { id: "appNEW1", name: "A", permissionLevel: "read" },
    ]);

    await runWorkspaceRediscovery(
      { ...baseInput, triggeredBy: "manual" },
      asDeps(deps),
    );

    const [, opts] = deps.upsertAtBases.mock.calls[0]!;
    expect(opts.discoveredViaForFreshInserts).toBe("rediscovery_manual");
  });
});
