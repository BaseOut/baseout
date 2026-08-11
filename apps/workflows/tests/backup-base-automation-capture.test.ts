// Tests for the MCP automations capture step in runBackupBase
// (workflows-mcp-automations tasks 3.1–3.3). Mirrors the harness in
// backup-base-interface-capture.test.ts.
//
// The spec's hard rules exercised here:
//   - a successful capture rides the schema-sync POST as `automations`
//     (4th syncSchema arg), independent of `interfacePages`,
//   - below-tier (or flag absent) makes ZERO automation MCP requests,
//   - NO capture failure mode may change the backup run's outcome or the
//     independent interface capture,
//   - a skipped capture OMITS the field from schema-sync (absent ≠ deleted),
//   - a 401 additionally surfaces the connection-scope notice.

import { describe, expect, it, vi, type Mock } from "vitest";
import { runBackupBase, type BackupBaseDeps } from "../trigger/tasks/backup-base";
import type {
  FetchAutomationsResult,
  FetchInterfacePagesResult,
} from "../trigger/tasks/_lib/mcp-client";
import type {
  AirtableSchema,
  AirtableRecordsPage,
} from "../trigger/tasks/_lib/airtable-client";

const ENGINE = "https://engine.example.com";
const TOKEN = "internal-token";

function makeFetchMock(): typeof fetch {
  return vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/lock")) return new Response("{}", { status: 200 });
    if (url.endsWith("/unlock")) return new Response("{}", { status: 200 });
    if (url.endsWith("/token")) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(JSON.stringify({ accessToken: `pt-${body.encryptedToken}` }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 500 });
  }) as unknown as typeof fetch;
}

const SCHEMA: AirtableSchema = {
  tables: [
    {
      id: "tbl1",
      name: "Tasks",
      primaryFieldId: "f1",
      fields: [{ id: "f1", name: "Name", type: "singleLineText" }],
      views: [],
    },
  ],
};

const PAGES: AirtableRecordsPage[] = [
  { records: [{ id: "rec1", createdTime: "2026-01-01T00:00:00Z", fields: { Name: "A" } }] },
];

function makeClient() {
  let i = 0;
  return {
    listBases: vi.fn(),
    getBaseSchema: vi.fn(async () => SCHEMA),
    listRecords: vi.fn(async () => PAGES[i++] ?? { records: [] }),
  };
}

const AUTOMATIONS_ENVELOPE = {
  automations: [{ id: "wflX", name: "Notify", deploymentStatus: "enabled" }],
};
const INTERFACES_ENVELOPE = {
  interfaces: [{ id: "pbdX", name: "Interface", pages: [] }],
  standaloneForms: [],
};
const CAPTURED_AT = "2026-07-24T10:00:00.000Z";

const okAutomations = (): FetchAutomationsResult => ({
  ok: true,
  raw: AUTOMATIONS_ENVELOPE,
  capturedAt: CAPTURED_AT,
});
const okInterfaces = (): FetchInterfacePagesResult => ({
  ok: true,
  raw: INTERFACES_ENVELOPE,
  capturedAt: CAPTURED_AT,
});

const INPUT = {
  runId: "11111111-1111-4111-8111-111111111111",
  connectionId: "conn-1",
  atBaseId: "appXYZ",
  isTrial: false,
  encryptedToken: "cipher",
  orgSlug: "acme",
  spaceName: "MySpace",
  baseName: "ProjectsDB",
  runStartedAt: new Date("2026-05-02T12:00:00Z"),
  storageType: "local_fs",
  spaceId: "space-1",
  automationsEnabled: true,
};

type SyncSchemaMock = Mock<NonNullable<BackupBaseDeps["syncSchema"]>>;

const baseDeps = (over: Partial<BackupBaseDeps>): BackupBaseDeps & { syncSchema: SyncSchemaMock } =>
  ({
    engineUrl: ENGINE,
    internalToken: TOKEN,
    fetchImpl: makeFetchMock(),
    airtableClient: makeClient(),
    writeCsv: vi.fn(async () => ({})),
    syncSchema: vi.fn(async () => ({ recordsEnabled: false, baseRunId: "br-1" })) as SyncSchemaMock,
    ...over,
  }) as BackupBaseDeps & { syncSchema: SyncSchemaMock };

describe("runBackupBase — MCP automations capture", () => {
  it("a successful capture rides the schema-sync POST (4th arg) and reports captured", async () => {
    const deps = baseDeps({ fetchAutomations: vi.fn(async () => okAutomations()) });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.automations).toEqual({ status: "captured" });
    expect(deps.fetchAutomations).toHaveBeenCalledWith({
      baseId: "appXYZ",
      accessToken: "pt-cipher",
    });
    expect(deps.syncSchema).toHaveBeenCalledTimes(1);
    expect(deps.syncSchema.mock.calls[0]![3]).toEqual({
      capturedAt: CAPTURED_AT,
      raw: AUTOMATIONS_ENVELOPE,
    });
  });

  it("flag absent → zero automation MCP requests, field omitted", async () => {
    const fetchAutomationsMock = vi.fn(async () => okAutomations());
    const deps = baseDeps({ fetchAutomations: fetchAutomationsMock });
    const { automationsEnabled: _omit, ...input } = INPUT;

    const result = await runBackupBase(input, deps);

    expect(result.status).toBe("succeeded");
    expect(result.automations).toBeUndefined();
    expect(fetchAutomationsMock).not.toHaveBeenCalled();
    expect(deps.syncSchema.mock.calls[0]![3]).toBeUndefined();
  });

  it("automationsEnabled: false → zero requests", async () => {
    const fetchAutomationsMock = vi.fn(async () => okAutomations());
    const deps = baseDeps({ fetchAutomations: fetchAutomationsMock });

    await runBackupBase({ ...INPUT, automationsEnabled: false }, deps);

    expect(fetchAutomationsMock).not.toHaveBeenCalled();
  });

  it("no syncSchema wired → zero requests even when enabled", async () => {
    const fetchAutomationsMock = vi.fn(async () => okAutomations());
    const deps = baseDeps({ fetchAutomations: fetchAutomationsMock, syncSchema: undefined });

    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(fetchAutomationsMock).not.toHaveBeenCalled();
  });

  it("a skipped capture omits the field, reports the reason, and never touches the run outcome", async () => {
    const deps = baseDeps({
      fetchAutomations: vi.fn(async (): Promise<FetchAutomationsResult> => ({ ok: false, reason: "timeout" })),
    });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.automations).toEqual({ status: "skipped", reason: "timeout" });
    expect(result.recordsProcessed).toBe(1);
    expect(deps.syncSchema).toHaveBeenCalledTimes(1);
    expect(deps.syncSchema.mock.calls[0]![3]).toBeUndefined();
  });

  it("a 401 skip carries the connection-scope notice", async () => {
    const deps = baseDeps({
      fetchAutomations: vi.fn(async (): Promise<FetchAutomationsResult> => ({ ok: false, reason: "auth" })),
    });
    const result = await runBackupBase(INPUT, deps);

    expect(result.automations).toEqual({
      status: "skipped",
      reason: "auth",
      notice: "connection_scope",
    });
  });

  it("a throwing injected fetcher is caught as transport and the run still succeeds", async () => {
    const deps = baseDeps({
      fetchAutomations: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.automations).toEqual({ status: "skipped", reason: "transport" });
  });

  it("automation failure leaves a concurrent interface capture untouched (and vice versa)", async () => {
    const deps = baseDeps({
      fetchInterfacePages: vi.fn(async () => okInterfaces()),
      fetchAutomations: vi.fn(async (): Promise<FetchAutomationsResult> => ({ ok: false, reason: "http_500" })),
    });
    const result = await runBackupBase({ ...INPUT, interfacesEnabled: true }, deps);

    expect(result.status).toBe("succeeded");
    expect(result.interfacePages).toEqual({ status: "captured" });
    expect(result.automations).toEqual({ status: "skipped", reason: "http_500" });
    expect(deps.syncSchema.mock.calls[0]![2]).toEqual({ capturedAt: CAPTURED_AT, raw: INTERFACES_ENVELOPE });
    expect(deps.syncSchema.mock.calls[0]![3]).toBeUndefined();
  });

  it("both captures succeed → both fields ride the same schema-sync", async () => {
    const deps = baseDeps({
      fetchInterfacePages: vi.fn(async () => okInterfaces()),
      fetchAutomations: vi.fn(async () => okAutomations()),
    });
    const result = await runBackupBase({ ...INPUT, interfacesEnabled: true }, deps);

    expect(result.interfacePages).toEqual({ status: "captured" });
    expect(result.automations).toEqual({ status: "captured" });
    const call = deps.syncSchema.mock.calls[0]!;
    expect(call[2]).toEqual({ capturedAt: CAPTURED_AT, raw: INTERFACES_ENVELOPE });
    expect(call[3]).toEqual({ capturedAt: CAPTURED_AT, raw: AUTOMATIONS_ENVELOPE });
  });

  it("schema-only runs still capture automations and report the outcome", async () => {
    const deps = baseDeps({ fetchAutomations: vi.fn(async () => okAutomations()) });
    const result = await runBackupBase({ ...INPUT, kind: "schema" }, deps);

    expect(result.status).toBe("succeeded");
    expect(result.recordsProcessed).toBe(0);
    expect(result.automations).toEqual({ status: "captured" });
    expect(deps.syncSchema.mock.calls[0]![3]).toEqual({
      capturedAt: CAPTURED_AT,
      raw: AUTOMATIONS_ENVELOPE,
    });
  });
});
