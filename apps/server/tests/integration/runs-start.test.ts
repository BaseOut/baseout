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

  it("returns unsupported_storage_type when storageType is not 'r2_managed'", async () => {
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
