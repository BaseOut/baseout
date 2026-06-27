// Pure-function tests for the restore-start orchestration (server-restore Phase B.1).
//
// Mirrors runs-start.test.ts exactly. Extract validation + fan-out into
// `processRestoreStart(input, deps)` and inject DB queries + Trigger.dev
// enqueue as discrete dep functions. Tests use vi.fn() for every dep so
// they cover all validation paths cheaply without touching Postgres or
// Trigger.dev.
//
// Routing tests (401 missing token, 400 malformed restoreId) live in
// restores-start-route.test.ts; this file is the validation logic.

import { describe, expect, it, vi } from "vitest";
import { processRestoreStart } from "../../src/lib/restores/start";
import type {
  RestoreRunRow,
  ConnectionRow,
  StorageDestinationRow,
  BackupRunRow,
} from "../../src/db/schema";

const RESTORE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BACKUP_RUN_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CONNECTION_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const ORG_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const SPACE_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const STORAGE_DEST_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const ENCRYPTED_TOKEN_CIPHERTEXT = "xyz789-base64-ciphertext";
const NOW = new Date("2026-06-26T12:00:00.000Z");
/** startedAt of the SOURCE backup run — the `<datetime>` segment in the CSV path. */
const SOURCE_RUN_STARTED_AT = new Date("2026-06-25T08:30:00.000Z");
const AT_BASE_ID = "appAAA111";
const BASE_NAME = "My Airtable Base";

function makeRestoreRun(
  overrides: Partial<RestoreRunRow> = {},
): RestoreRunRow {
  return {
    id: RESTORE_ID,
    spaceId: SPACE_ID,
    connectionId: CONNECTION_ID,
    sourceRunId: BACKUP_RUN_ID,
    status: "queued",
    scope: "base",
    scopeTarget: { baseId: AT_BASE_ID },
    tablesRestored: 0,
    recordsRestored: 0,
    attachmentsRestored: 0,
    triggerRunIds: [],
    triggeredBy: "user_manual",
    isTrial: false,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    errorMessage: null,
    modifiedAt: new Date("2026-06-26T11:00:00.000Z"),
    ...overrides,
  };
}

function makeSourceBackupRun(
  overrides: Partial<Pick<BackupRunRow, "id" | "spaceId" | "status" | "startedAt">> = {},
): Pick<BackupRunRow, "id" | "spaceId" | "status" | "startedAt"> {
  return {
    id: BACKUP_RUN_ID,
    spaceId: SPACE_ID,
    status: "succeeded",
    startedAt: SOURCE_RUN_STARTED_AT,
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
    oauthRefreshClaimId: null,
    oauthRefreshClaimedAt: null,
    oauthRefreshLastError: null,
    modifiedAt: new Date("2026-06-26T10:00:00.000Z"),
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeStorageDest(
  overrides: Partial<StorageDestinationRow> = {},
): StorageDestinationRow {
  return {
    id: STORAGE_DEST_ID,
    spaceId: SPACE_ID,
    type: "local_fs",
    oauthAccessTokenEnc: null,
    oauthRefreshTokenEnc: null,
    oauthExpiresAt: null,
    oauthScope: null,
    oauthAccountEmail: null,
    providerFolderId: null,
    providerAccountId: null,
    connectedByUserId: null,
    connectedAt: new Date("2026-06-01T00:00:00.000Z"),
    lastValidatedAt: null,
    ...overrides,
  };
}

interface DepsBag {
  fetchRestoreRunById: ReturnType<typeof vi.fn>;
  fetchConnectionById: ReturnType<typeof vi.fn>;
  fetchStorageDestinationBySpace: ReturnType<typeof vi.fn>;
  fetchSourceRun: ReturnType<typeof vi.fn>;
  fetchBaseName: ReturnType<typeof vi.fn>;
  updateRestoreRunStarted: ReturnType<typeof vi.fn>;
  updateRestoreRunTriggerIds: ReturnType<typeof vi.fn>;
  enqueueRestoreBase: ReturnType<typeof vi.fn>;
}

function makeDeps(): DepsBag {
  return {
    fetchRestoreRunById: vi.fn(async () => makeRestoreRun()),
    fetchConnectionById: vi.fn(async () => makeConnection()),
    fetchStorageDestinationBySpace: vi.fn(async () => makeStorageDest()),
    fetchSourceRun: vi.fn(async () => makeSourceBackupRun()),
    fetchBaseName: vi.fn(async () => BASE_NAME),
    updateRestoreRunStarted: vi.fn(async () => {}),
    updateRestoreRunTriggerIds: vi.fn(async () => {}),
    enqueueRestoreBase: vi.fn(async (_p: unknown) => ({ id: `run_${Date.now()}` })),
  };
}

describe("processRestoreStart — happy path", () => {
  it("returns ok result with restoreId + ordered triggerRunIds", async () => {
    const deps = makeDeps();
    deps.enqueueRestoreBase = vi
      .fn()
      .mockResolvedValueOnce({ id: "run_aaa" });

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({
      ok: true,
      restoreId: RESTORE_ID,
      triggerRunIds: ["run_aaa"],
    });
  });

  it("UPDATEs status to running with started_at = now() before enqueueing", async () => {
    const deps = makeDeps();
    let startedBeforeFirstEnqueue = false;
    deps.enqueueRestoreBase = vi.fn(async () => {
      startedBeforeFirstEnqueue =
        deps.updateRestoreRunStarted.mock.calls.length > 0;
      return { id: "run_a" };
    });

    await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(deps.updateRestoreRunStarted).toHaveBeenCalledWith(RESTORE_ID, NOW);
    expect(startedBeforeFirstEnqueue).toBe(true);
  });

  it("persists trigger_run_ids exactly once after all enqueues complete", async () => {
    const deps = makeDeps();
    deps.enqueueRestoreBase = vi
      .fn()
      .mockResolvedValueOnce({ id: "run_a" });

    await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(deps.updateRestoreRunTriggerIds).toHaveBeenCalledTimes(1);
    expect(deps.updateRestoreRunTriggerIds).toHaveBeenCalledWith(RESTORE_ID, [
      "run_a",
    ]);
  });

  it("enqueues one task with the canonical payload shape", async () => {
    const deps = makeDeps();
    deps.enqueueRestoreBase = vi
      .fn()
      .mockResolvedValueOnce({ id: "run_a" });

    await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(deps.enqueueRestoreBase).toHaveBeenCalledTimes(1);
    const [firstCall] = deps.enqueueRestoreBase.mock.calls;
    expect(firstCall?.[0]).toEqual({
      restoreId: RESTORE_ID,
      connectionId: CONNECTION_ID,
      sourceRunId: BACKUP_RUN_ID,
      atBaseId: AT_BASE_ID,
      baseName: BASE_NAME,       // resolved display name — path segment the backup wrote
      isTrial: false,
      encryptedToken: ENCRYPTED_TOKEN_CIPHERTEXT,
      orgSlug: ORG_ID,           // β: UUID, not slug
      spaceName: SPACE_ID,       // β: UUID, not name
      storageType: "local_fs",
      spaceId: SPACE_ID,
      scope: "base",
      scopeTarget: { baseId: AT_BASE_ID },
      // SOURCE backup run's startedAt — NOT the restore's own start time.
      // This is the <datetime> segment in the CSV storage path.
      sourceRunStartedAt: SOURCE_RUN_STARTED_AT.toISOString(),
    });
    // Ensure the old wrong field is NOT present
    expect(firstCall?.[0]).not.toHaveProperty("restoreStartedAt");
  });

  it("propagates isTrial=true into the per-base payload", async () => {
    const deps = makeDeps();
    deps.fetchRestoreRunById = vi.fn(async () =>
      makeRestoreRun({ isTrial: true }),
    );
    deps.enqueueRestoreBase = vi.fn(async () => ({ id: "run_a" }));

    await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(deps.enqueueRestoreBase.mock.calls[0]?.[0]).toMatchObject({
      isTrial: true,
    });
  });

  it("fans out with scope_target.tableId when scope is 'table'", async () => {
    const deps = makeDeps();
    deps.fetchRestoreRunById = vi.fn(async () =>
      makeRestoreRun({
        scope: "table",
        scopeTarget: { baseId: AT_BASE_ID, tableId: "tblXXXX" },
      }),
    );
    deps.enqueueRestoreBase = vi.fn(async () => ({ id: "run_a" }));

    await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(deps.enqueueRestoreBase.mock.calls[0]?.[0]).toMatchObject({
      scope: "table",
      scopeTarget: { baseId: "appAAA111", tableId: "tblXXXX" },
    });
  });
});

describe("processRestoreStart — validation failures", () => {
  it("returns restore_not_found when fetchRestoreRunById resolves to null", async () => {
    const deps = makeDeps();
    deps.fetchRestoreRunById = vi.fn(async () => null);

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "restore_not_found" });
    expect(deps.updateRestoreRunStarted).not.toHaveBeenCalled();
    expect(deps.enqueueRestoreBase).not.toHaveBeenCalled();
  });

  it("returns restore_already_started when restore.status is not 'queued' (409 case)", async () => {
    const deps = makeDeps();
    deps.fetchRestoreRunById = vi.fn(async () =>
      makeRestoreRun({ status: "running" }),
    );

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "restore_already_started" });
    expect(deps.enqueueRestoreBase).not.toHaveBeenCalled();
  });

  it("returns restore_already_started when restore.status is a terminal status (idempotency 409)", async () => {
    const deps = makeDeps();
    deps.fetchRestoreRunById = vi.fn(async () =>
      makeRestoreRun({ status: "succeeded" }),
    );

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "restore_already_started" });
    expect(deps.enqueueRestoreBase).not.toHaveBeenCalled();
  });

  it("returns connection_not_found when fetchConnectionById resolves to null (422)", async () => {
    const deps = makeDeps();
    deps.fetchConnectionById = vi.fn(async () => null);

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "connection_not_found" });
  });

  it("returns invalid_connection when connection.status is not 'active' (422)", async () => {
    const deps = makeDeps();
    deps.fetchConnectionById = vi.fn(async () =>
      makeConnection({ status: "pending_reauth" }),
    );

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "invalid_connection" });
  });

  it("returns storage_not_found when fetchStorageDestinationBySpace resolves to null (422)", async () => {
    const deps = makeDeps();
    deps.fetchStorageDestinationBySpace = vi.fn(async () => null);

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "storage_not_found" });
  });

  it("does not write trigger_run_ids if updateRestoreRunStarted has not run", async () => {
    const deps = makeDeps();
    deps.fetchRestoreRunById = vi.fn(async () => null);

    await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(deps.updateRestoreRunStarted).not.toHaveBeenCalled();
    expect(deps.updateRestoreRunTriggerIds).not.toHaveBeenCalled();
  });

  it("returns source_run_not_found when fetchSourceRun resolves to null (422)", async () => {
    const deps = makeDeps();
    deps.fetchSourceRun = vi.fn(async () => null);

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "source_run_not_found" });
    expect(deps.updateRestoreRunStarted).not.toHaveBeenCalled();
    expect(deps.enqueueRestoreBase).not.toHaveBeenCalled();
  });

  it("returns source_run_not_restorable when source run belongs to a different space (422)", async () => {
    const deps = makeDeps();
    deps.fetchSourceRun = vi.fn(async () =>
      makeSourceBackupRun({ spaceId: "different-space-id" }),
    );

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "source_run_not_restorable" });
    expect(deps.updateRestoreRunStarted).not.toHaveBeenCalled();
    expect(deps.enqueueRestoreBase).not.toHaveBeenCalled();
  });

  it("returns source_run_not_restorable when source run has a non-terminal status (422)", async () => {
    const deps = makeDeps();
    deps.fetchSourceRun = vi.fn(async () =>
      makeSourceBackupRun({ status: "running" }),
    );

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "source_run_not_restorable" });
    expect(deps.updateRestoreRunStarted).not.toHaveBeenCalled();
    expect(deps.enqueueRestoreBase).not.toHaveBeenCalled();
  });

  it("returns source_run_not_restorable when source run has a null startedAt (422)", async () => {
    const deps = makeDeps();
    deps.fetchSourceRun = vi.fn(async () =>
      makeSourceBackupRun({ startedAt: null }),
    );

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "source_run_not_restorable" });
    expect(deps.updateRestoreRunStarted).not.toHaveBeenCalled();
    expect(deps.enqueueRestoreBase).not.toHaveBeenCalled();
  });

  it("returns source_run_not_restorable when source run status is 'failed' (not a restorable terminal)", async () => {
    const deps = makeDeps();
    deps.fetchSourceRun = vi.fn(async () =>
      makeSourceBackupRun({ status: "failed" }),
    );

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toEqual({ ok: false, error: "source_run_not_restorable" });
    expect(deps.updateRestoreRunStarted).not.toHaveBeenCalled();
    expect(deps.enqueueRestoreBase).not.toHaveBeenCalled();
  });

  it("accepts source run with status 'trial_succeeded' as restorable", async () => {
    const deps = makeDeps();
    deps.fetchSourceRun = vi.fn(async () =>
      makeSourceBackupRun({ status: "trial_succeeded" }),
    );
    deps.enqueueRestoreBase = vi.fn(async () => ({ id: "run_a" }));

    const result = await processRestoreStart(
      { restoreId: RESTORE_ID },
      { ...deps, now: () => NOW },
    );

    expect(result).toMatchObject({ ok: true });
    expect(deps.enqueueRestoreBase).toHaveBeenCalledTimes(1);
  });
});
