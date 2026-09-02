// Pure-function tests for the run-start orchestration (Phase 8a).
//
// Mirrors the Phase 7 testing pattern: extract validation + fan-out into
// `processRunStart(input, deps)` and inject DB queries + Trigger.dev
// enqueue as discrete dep functions. Tests use vi.fn() for every dep so
// they cover all validation paths cheaply without touching Postgres or
// Trigger.dev.
//
// Routing tests (401 missing token, 400 malformed runId) live in
// runs-start-route.test.ts; this file is the validation logic.
//
// Phase 8 scope decisions (captured at the top of the plan file) applied:
//   - β: orgSlug ← connection.organizationId (UUID), spaceName ← run.spaceId (UUID).
//   - Skip the trial_backup_run_used check; Phase 7 runtime caps cover it.

import { describe, expect, it, vi } from "vitest";
import { processRunStart } from "../../src/lib/runs/start";
import type {
  BackupRunRow,
  ConnectionRow,
  BackupConfigurationRow,
} from "../../src/db/schema";

const RUN_ID = "11111111-1111-1111-1111-111111111111";
const CONNECTION_ID = "22222222-2222-2222-2222-222222222222";
const ORG_ID = "33333333-3333-3333-3333-333333333333";
const SPACE_ID = "44444444-4444-4444-4444-444444444444";
const CONFIG_ID = "55555555-5555-5555-5555-555555555555";
const ENCRYPTED_TOKEN_CIPHERTEXT = "abc123-base64-ciphertext";
const NOW = new Date("2026-05-08T18:30:00.000Z");

function makeRun(overrides: Partial<BackupRunRow> = {}): BackupRunRow {
  return {
    id: RUN_ID,
    spaceId: SPACE_ID,
    connectionId: CONNECTION_ID,
    status: "queued",
    isTrial: false,
    recordCount: null,
    tableCount: null,
    attachmentCount: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    triggerRunIds: null,
    modifiedAt: new Date("2026-05-08T18:00:00.000Z"),
    ...overrides,
  };
}

function makeConnection(overrides: Partial<ConnectionRow> = {}): ConnectionRow {
  return {
    id: CONNECTION_ID,
    organizationId: ORG_ID,
    platformId: "airtable-platform-id",
    status: "active",
    accessTokenEnc: ENCRYPTED_TOKEN_CIPHERTEXT,
    refreshTokenEnc: null,
    tokenExpiresAt: null,
    scopes: "data.records:read schema.bases:read",
    platformConfig: null,
    invalidatedAt: null,
    modifiedAt: new Date("2026-05-08T17:00:00.000Z"),
    ...overrides,
  };
}

function makeConfig(
  overrides: Partial<BackupConfigurationRow> = {},
): BackupConfigurationRow {
  return {
    id: CONFIG_ID,
    spaceId: SPACE_ID,
    mode: "static",
    storageType: "r2_managed",
    ...overrides,
  };
}

interface DepsBag {
  fetchRunById: ReturnType<typeof vi.fn>;
  fetchConnectionById: ReturnType<typeof vi.fn>;
  fetchConfigBySpace: ReturnType<typeof vi.fn>;
  fetchIncludedBases: ReturnType<typeof vi.fn>;
  updateRunStarted: ReturnType<typeof vi.fn>;
  updateRunTriggerIds: ReturnType<typeof vi.fn>;
  enqueueBackupBase: ReturnType<typeof vi.fn>;
  resolveInterfacesEnabled: ReturnType<typeof vi.fn>;
  resolveAutomationsEnabled: ReturnType<typeof vi.fn>;
}

function makeDeps(): DepsBag {
  return {
    fetchRunById: vi.fn(async () => makeRun()),
    fetchConnectionById: vi.fn(async () => makeConnection()),
    fetchConfigBySpace: vi.fn(async () => makeConfig()),
    fetchIncludedBases: vi.fn(async () => [
      { atBaseId: "appAAA111", name: "Tasks" },
      { atBaseId: "appBBB222", name: "Projects" },
    ]),
    updateRunStarted: vi.fn(async () => {}),
    updateRunTriggerIds: vi.fn(async () => {}),
    enqueueBackupBase: vi.fn(async (_p: unknown) => ({ id: `run_${Date.now()}` })),
    resolveInterfacesEnabled: vi.fn(async () => false),
    resolveAutomationsEnabled: vi.fn(async () => false),
    resolveCommentsEnabled: vi.fn(async () => false),
  };
}

describe("processRunStart — happy path", () => {
  it("returns 202-shape result with runId + ordered triggerRunIds", async () => {
    const deps = makeDeps();
    deps.enqueueBackupBase = vi
      .fn()
      .mockResolvedValueOnce({ id: "run_aaa" })
      .mockResolvedValueOnce({ id: "run_bbb" });

    const result = await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({
      ok: true,
      runId: RUN_ID,
      triggerRunIds: ["run_aaa", "run_bbb"],
    });
  });

  it("UPDATEs status to running with started_at = now() before enqueueing", async () => {
    const deps = makeDeps();
    let startedBeforeFirstEnqueue = false;
    deps.enqueueBackupBase = vi.fn(async () => {
      startedBeforeFirstEnqueue =
        deps.updateRunStarted.mock.calls.length > 0;
      return { id: "run_a" };
    });

    await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(deps.updateRunStarted).toHaveBeenCalledWith(RUN_ID, NOW);
    expect(startedBeforeFirstEnqueue).toBe(true);
  });

  it("persists trigger_run_ids exactly once after all enqueues complete", async () => {
    const deps = makeDeps();
    deps.enqueueBackupBase = vi
      .fn()
      .mockResolvedValueOnce({ id: "run_a" })
      .mockResolvedValueOnce({ id: "run_b" });

    await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(deps.updateRunTriggerIds).toHaveBeenCalledTimes(1);
    expect(deps.updateRunTriggerIds).toHaveBeenCalledWith(RUN_ID, [
      "run_a",
      "run_b",
    ]);
  });

  it("enqueues one task per included base, with the canonical payload shape (β decision: UUIDs as path placeholders)", async () => {
    const deps = makeDeps();
    deps.enqueueBackupBase = vi
      .fn()
      .mockResolvedValueOnce({ id: "run_a" })
      .mockResolvedValueOnce({ id: "run_b" });

    await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(deps.enqueueBackupBase).toHaveBeenCalledTimes(2);
    const [first, second] = deps.enqueueBackupBase.mock.calls;
    expect(first?.[0]).toEqual({
      runId: RUN_ID,
      connectionId: CONNECTION_ID,
      atBaseId: "appAAA111",
      isTrial: false,
      encryptedToken: ENCRYPTED_TOKEN_CIPHERTEXT,
      orgSlug: ORG_ID,            // β: UUID, not slug
      spaceName: SPACE_ID,        // β: UUID, not name
      baseName: "Tasks",
      runStartedAt: NOW.toISOString(),
      storageType: "r2_managed",
      spaceId: SPACE_ID,
      kind: "full",
      interfacesEnabled: false,
      automationsEnabled: false,
      commentsEnabled: false,
      viewCaptureMode: "mcp", // fixture connection is non-enterprise (server-mcp-views)
    });
    expect(second?.[0]).toEqual({
      runId: RUN_ID,
      connectionId: CONNECTION_ID,
      atBaseId: "appBBB222",
      isTrial: false,
      encryptedToken: ENCRYPTED_TOKEN_CIPHERTEXT,
      orgSlug: ORG_ID,
      spaceName: SPACE_ID,
      baseName: "Projects",
      runStartedAt: NOW.toISOString(),
      storageType: "r2_managed",
      spaceId: SPACE_ID,
      kind: "full",
      interfacesEnabled: false,
      automationsEnabled: false,
      commentsEnabled: false,
      viewCaptureMode: "mcp",
    });
  });

  it("forwards run.kind='schema' into the per-base payload (server-backup-scope)", async () => {
    const deps = makeDeps();
    deps.fetchRunById = vi.fn(async () => makeRun({ kind: "schema" }));
    deps.fetchIncludedBases = vi.fn(async () => [
      { atBaseId: "appAAA111", name: "Tasks" },
    ]);

    await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });

    expect(deps.enqueueBackupBase.mock.calls[0]?.[0]).toMatchObject({
      kind: "schema",
    });
  });

  it("propagates isTrial=true into the per-base payload", async () => {
    const deps = makeDeps();
    deps.fetchRunById = vi.fn(async () => makeRun({ isTrial: true }));
    deps.fetchIncludedBases = vi.fn(async () => [
      { atBaseId: "appAAA111", name: "Tasks" },
    ]);

    await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(deps.enqueueBackupBase.mock.calls[0]?.[0]).toMatchObject({
      isTrial: true,
    });
  });
});

describe("processRunStart — validation failures", () => {
  it("returns env_mismatch when the Organization is not in this Worker env", async () => {
    const deps = makeDeps();
    const result = await processRunStart(
      { runId: RUN_ID },
      {
        ...deps,
        now: () => NOW,
        assertOrganizationRuntimeEnv: async () => false,
      },
    );

    expect(result).toEqual({ ok: false, error: "env_mismatch" });
    expect(deps.enqueueBackupBase).not.toHaveBeenCalled();
  });
  it("returns run_not_found when fetchRunById resolves to null", async () => {
    const deps = makeDeps();
    deps.fetchRunById = vi.fn(async () => null);

    const result = await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "run_not_found" });
    expect(deps.updateRunStarted).not.toHaveBeenCalled();
    expect(deps.enqueueBackupBase).not.toHaveBeenCalled();
  });

  it("returns run_already_started when run.status is not 'queued'", async () => {
    const deps = makeDeps();
    deps.fetchRunById = vi.fn(async () => makeRun({ status: "running" }));

    const result = await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "run_already_started" });
    expect(deps.enqueueBackupBase).not.toHaveBeenCalled();
  });

  it("returns connection_not_found when fetchConnectionById resolves to null", async () => {
    const deps = makeDeps();
    deps.fetchConnectionById = vi.fn(async () => null);

    const result = await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "connection_not_found" });
  });

  it("returns invalid_connection when connection.status is not 'active'", async () => {
    const deps = makeDeps();
    deps.fetchConnectionById = vi.fn(async () =>
      makeConnection({ status: "pending_reauth" }),
    );

    const result = await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "invalid_connection" });
  });

  it("returns config_not_found when fetchConfigBySpace resolves to null", async () => {
    const deps = makeDeps();
    deps.fetchConfigBySpace = vi.fn(async () => null);

    const result = await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "config_not_found" });
  });

  it("returns unsupported_storage_type for a storageType outside the accept-list", async () => {
    // 'byos' is a bogus value that never matches a writer — stands in for any
    // storage_type the workflows StorageWriter factory can't resolve.
    const deps = makeDeps();
    deps.fetchConfigBySpace = vi.fn(async () =>
      makeConfig({ storageType: "byos" }),
    );

    const result = await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "unsupported_storage_type" });
  });

  // Every BYOS provider the workflows StorageWriter factory + engine
  // credential route support must clear the gate (apps/server/src/lib/runs/
  // start.ts ACCEPTED_STORAGE_TYPES). Box + Dropbox regressed here: the
  // factory/cred-route shipped them but the gate still rejected, so runs
  // failed with unsupported_storage_type after a successful Connect.
  it.each(["google_drive", "box", "dropbox", "onedrive"])(
    "accepts storageType '%s' and forwards it into the per-base payload",
    async (storageType) => {
      const deps = makeDeps();
      deps.fetchConfigBySpace = vi.fn(async () => makeConfig({ storageType }));
      deps.fetchIncludedBases = vi.fn(async () => [
        { atBaseId: "appAAA111", name: "Tasks" },
      ]);
      deps.enqueueBackupBase = vi.fn(async () => ({ id: "run_a" }));

      const result = await processRunStart(
        { runId: RUN_ID },
        { ...deps, now: () => NOW },
      );

      expect(result).toEqual({
        ok: true,
        runId: RUN_ID,
        triggerRunIds: ["run_a"],
      });
      expect(deps.enqueueBackupBase.mock.calls[0]?.[0]).toMatchObject({
        storageType,
        spaceId: SPACE_ID,
      });
    },
  );

  it("returns no_bases_selected when fetchIncludedBases resolves to []", async () => {
    const deps = makeDeps();
    deps.fetchIncludedBases = vi.fn(async () => []);

    const result = await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "no_bases_selected" });
    expect(deps.updateRunStarted).not.toHaveBeenCalled();
  });

  it("does not write trigger_run_ids if updateRunStarted has not run", async () => {
    // Belt-and-braces: any validation failure path must NOT have side-effected
    // the row before bailing.
    const deps = makeDeps();
    deps.fetchRunById = vi.fn(async () => null);

    await processRunStart(
      { runId: RUN_ID },
      { ...deps, now: () => NOW },
    );

    expect(deps.updateRunStarted).not.toHaveBeenCalled();
    expect(deps.updateRunTriggerIds).not.toHaveBeenCalled();
  });
});

describe("processRunStart — interfaces_enabled tier gate (server-mcp-interface-pages)", () => {
  it("stamps interfacesEnabled: true on every task payload for a Growth+ org", async () => {
    const deps = makeDeps();
    deps.resolveInterfacesEnabled = vi.fn(async () => true);

    const result = await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });

    expect(result.ok).toBe(true);
    expect(deps.resolveInterfacesEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(deps.enqueueBackupBase).toHaveBeenCalledTimes(2);
    for (const call of deps.enqueueBackupBase.mock.calls) {
      expect(call[0]).toMatchObject({ interfacesEnabled: true });
    }
  });

  it("stamps interfacesEnabled: false for a below-Growth org", async () => {
    const deps = makeDeps();
    deps.resolveInterfacesEnabled = vi.fn(async () => false);

    await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });

    for (const call of deps.enqueueBackupBase.mock.calls) {
      expect(call[0]).toMatchObject({ interfacesEnabled: false });
    }
  });

  it("resolves the gate once per run, not per base", async () => {
    const deps = makeDeps();

    await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });

    expect(deps.enqueueBackupBase).toHaveBeenCalledTimes(2);
    expect(deps.resolveInterfacesEnabled).toHaveBeenCalledTimes(1);
  });
});

describe("processRunStart — automations_enabled tier gate (server-mcp-automations)", () => {
  it("stamps automationsEnabled: true on every task payload for a Growth+ org", async () => {
    const deps = makeDeps();
    deps.resolveAutomationsEnabled = vi.fn(async () => true);

    const result = await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });

    expect(result.ok).toBe(true);
    expect(deps.resolveAutomationsEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(deps.enqueueBackupBase).toHaveBeenCalledTimes(2);
    for (const call of deps.enqueueBackupBase.mock.calls) {
      expect(call[0]).toMatchObject({ automationsEnabled: true });
    }
  });

  it("stamps automationsEnabled: false for a below-Growth org", async () => {
    const deps = makeDeps();
    deps.resolveAutomationsEnabled = vi.fn(async () => false);

    await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });

    for (const call of deps.enqueueBackupBase.mock.calls) {
      expect(call[0]).toMatchObject({ automationsEnabled: false });
    }
  });

  it("gates independently of interfacesEnabled", async () => {
    const deps = makeDeps();
    deps.resolveInterfacesEnabled = vi.fn(async () => true);
    deps.resolveAutomationsEnabled = vi.fn(async () => false);

    await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });

    for (const call of deps.enqueueBackupBase.mock.calls) {
      expect(call[0]).toMatchObject({ interfacesEnabled: true, automationsEnabled: false });
    }
  });

  it("resolves the gate once per run, not per base", async () => {
    const deps = makeDeps();

    await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });

    expect(deps.enqueueBackupBase).toHaveBeenCalledTimes(2);
    expect(deps.resolveAutomationsEnabled).toHaveBeenCalledTimes(1);
  });
});

// server-mcp-workspaces: the run-start auto-enroll pre-step is optional and
// failure-isolated — it may never fail or delay the run.
describe("processRunStart — workspace auto-enroll pre-step", () => {
  it("calls the dep BEFORE fetchIncludedBases with the run's identifiers", async () => {
    const deps = makeDeps();
    const order: string[] = [];
    const runWorkspaceAutoEnroll = vi.fn(async () => {
      order.push("auto-enroll");
      return { ok: true, enrolledWorkspaces: 0, added: 0, skipped: 0 };
    });
    deps.fetchIncludedBases = vi.fn(async () => {
      order.push("fetch-bases");
      return [{ atBaseId: "appAAA111", name: "Tasks" }];
    });

    const result = await processRunStart(
      { runId: RUN_ID },
      { ...deps, runWorkspaceAutoEnroll, now: () => NOW },
    );

    expect(result.ok).toBe(true);
    expect(order).toEqual(["auto-enroll", "fetch-bases"]);
    expect(runWorkspaceAutoEnroll).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      connectionId: CONNECTION_ID,
      organizationId: ORG_ID,
      configId: CONFIG_ID,
    });
  });

  it("a rejecting dep never fails the run (failure isolation)", async () => {
    const deps = makeDeps();
    const runWorkspaceAutoEnroll = vi.fn(async () => {
      throw new Error("mcp exploded");
    });

    const result = await processRunStart(
      { runId: RUN_ID },
      { ...deps, runWorkspaceAutoEnroll, now: () => NOW },
    );

    expect(result.ok).toBe(true);
    expect(deps.enqueueBackupBase).toHaveBeenCalledTimes(2);
  });

  it("absent dep = pre-change behavior exactly", async () => {
    const deps = makeDeps();
    const result = await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });
    expect(result.ok).toBe(true);
  });
});

// server-comments: commentsEnabled stamped per run (rides the record-backup
// tier — recommended stance pending Dan).
describe("processRunStart — commentsEnabled stamp", () => {
  it("stamps commentsEnabled: true when the tier gate resolves open", async () => {
    const deps = makeDeps();
    deps.resolveCommentsEnabled = vi.fn(async () => true);

    await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });

    for (const call of deps.enqueueBackupBase.mock.calls) {
      expect(call[0]).toMatchObject({ commentsEnabled: true });
    }
    expect(deps.resolveCommentsEnabled).toHaveBeenCalledTimes(1); // once per run
  });

  it("gates independently of the other capture flags", async () => {
    const deps = makeDeps();
    deps.resolveCommentsEnabled = vi.fn(async () => true);
    deps.resolveInterfacesEnabled = vi.fn(async () => false);

    await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });

    for (const call of deps.enqueueBackupBase.mock.calls) {
      expect(call[0]).toMatchObject({ commentsEnabled: true, interfacesEnabled: false });
    }
  });
});

// server-mcp-views: viewCaptureMode stamped per run from the connection's
// enterprise scope, honoring the dev override.
describe("processRunStart — viewCaptureMode stamp", () => {
  it("stamps 'rest' for an enterprise-scope connection (today's path)", async () => {
    const deps = makeDeps();
    deps.fetchConnectionById = vi.fn(async () =>
      makeConnection({ platformConfig: { is_enterprise_scope: true } }),
    );

    await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });

    for (const call of deps.enqueueBackupBase.mock.calls) {
      expect(call[0]).toMatchObject({ viewCaptureMode: "rest" });
    }
  });

  it("stamps 'mcp' for a non-enterprise connection (the widening)", async () => {
    const deps = makeDeps();

    await processRunStart({ runId: RUN_ID }, { ...deps, now: () => NOW });

    for (const call of deps.enqueueBackupBase.mock.calls) {
      expect(call[0]).toMatchObject({ viewCaptureMode: "mcp" });
    }
  });

  it('viewCaptureOverride "1" stamps \'rest\' regardless of scope (legacy dev escape)', async () => {
    const deps = makeDeps();

    await processRunStart(
      { runId: RUN_ID },
      { ...deps, viewCaptureOverride: "1", now: () => NOW },
    );

    for (const call of deps.enqueueBackupBase.mock.calls) {
      expect(call[0]).toMatchObject({ viewCaptureMode: "rest" });
    }
  });
});
