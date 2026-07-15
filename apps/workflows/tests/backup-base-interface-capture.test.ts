// Tests for the MCP interface-pages capture step in runBackupBase
// (workflows-mcp-interface-pages tasks 3.1–3.3). Mirrors the harness in
// backup-base-per-space-sync.test.ts.
//
// The spec's hard rules exercised here:
//   - a successful capture rides the schema-sync POST as `interfacePages`,
//   - below-tier (or flag absent) makes ZERO MCP requests,
//   - NO capture failure mode may change the backup run's outcome,
//   - a skipped capture OMITS the field from schema-sync (absent ≠ deleted),
//   - a 401 additionally surfaces the connection-scope notice.

import { describe, expect, it, vi, type Mock } from "vitest";
import { runBackupBase, type BackupBaseDeps } from "../trigger/tasks/backup-base";
import type { FetchInterfacePagesResult } from "../trigger/tasks/_lib/mcp-client";
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

const ENVELOPE = {
  interfaces: [{ id: "pbdX", name: "Interface", pages: [] }],
  standaloneForms: [],
};
const CAPTURED_AT = "2026-07-14T10:00:00.000Z";

const okCapture = (): FetchInterfacePagesResult => ({
  ok: true,
  raw: ENVELOPE,
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
  interfacesEnabled: true,
};

type SyncSchemaMock = Mock<NonNullable<BackupBaseDeps["syncSchema"]>>;
type FetchInterfacesMock = Mock<NonNullable<BackupBaseDeps["fetchInterfacePages"]>>;

const baseDeps = (
  over: Partial<BackupBaseDeps>,
): BackupBaseDeps & { syncSchema: SyncSchemaMock; fetchInterfacePages?: FetchInterfacesMock } => ({
  engineUrl: ENGINE,
  internalToken: TOKEN,
  fetchImpl: makeFetchMock(),
  airtableClient: makeClient(),
  writeCsv: vi.fn(async () => ({})),
  syncSchema: vi.fn(async () => ({ recordsEnabled: false, baseRunId: "br-1" })) as SyncSchemaMock,
  ...over,
} as BackupBaseDeps & { syncSchema: SyncSchemaMock; fetchInterfacePages?: FetchInterfacesMock });

describe("runBackupBase — MCP interface-pages capture", () => {
  it("a successful capture rides the schema-sync POST and reports captured", async () => {
    const deps = baseDeps({ fetchInterfacePages: vi.fn(async () => okCapture()) });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.interfacePages).toEqual({ status: "captured" });
    expect(deps.fetchInterfacePages).toHaveBeenCalledWith({
      baseId: "appXYZ",
      accessToken: "pt-cipher",
    });
    expect(deps.syncSchema).toHaveBeenCalledTimes(1);
    expect(deps.syncSchema.mock.calls[0]![2]).toEqual({
      capturedAt: CAPTURED_AT,
      raw: ENVELOPE,
    });
  });

  it("below tier (interfacesEnabled false) makes ZERO MCP requests, silently", async () => {
    const fetchInterfacePages = vi.fn(async () => okCapture());
    const deps = baseDeps({ fetchInterfacePages });
    const result = await runBackupBase({ ...INPUT, interfacesEnabled: false }, deps);

    expect(fetchInterfacePages).not.toHaveBeenCalled();
    expect(result.interfacePages).toBeUndefined();
    expect(deps.syncSchema.mock.calls[0]![2]).toBeUndefined();
  });

  it("flag absent entirely (older engine payload) → zero MCP requests", async () => {
    const fetchInterfacePages = vi.fn(async () => okCapture());
    const { interfacesEnabled: _drop, ...withoutFlag } = INPUT;
    const result = await runBackupBase(withoutFlag, baseDeps({ fetchInterfacePages }));

    expect(fetchInterfacePages).not.toHaveBeenCalled();
    expect(result.interfacePages).toBeUndefined();
  });

  it("no syncSchema wired → capture is pointless, zero MCP requests", async () => {
    const fetchInterfacePages = vi.fn(async () => okCapture());
    const deps = baseDeps({ syncSchema: undefined, fetchInterfacePages });
    const result = await runBackupBase(INPUT, deps);

    expect(fetchInterfacePages).not.toHaveBeenCalled();
    expect(result.status).toBe("succeeded");
  });

  it.each<[string, FetchInterfacePagesResult]>([
    ["timeout", { ok: false, reason: "timeout" }],
    ["http_503", { ok: false, reason: "http_503" }],
    ["invalid_envelope", { ok: false, reason: "invalid_envelope" }],
    ["payload_too_large", { ok: false, reason: "payload_too_large" }],
  ])("skipped(%s): run outcome untouched, field OMITTED from schema-sync", async (_label, capture) => {
    const deps = baseDeps({ fetchInterfacePages: vi.fn(async () => capture) });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.tablesProcessed).toBe(1);
    expect(result.interfacePages).toEqual({
      status: "skipped",
      reason: (capture as { reason: string }).reason,
    });
    // Field omitted — the engine must never interpret a skip as a deletion.
    expect(deps.syncSchema).toHaveBeenCalledTimes(1);
    expect(deps.syncSchema.mock.calls[0]![2]).toBeUndefined();
  });

  it("401 (auth) additionally surfaces the connection-scope notice", async () => {
    const deps = baseDeps({
      fetchInterfacePages: vi.fn(async (): Promise<FetchInterfacePagesResult> => ({ ok: false, reason: "auth" })),
    });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.interfacePages).toEqual({
      status: "skipped",
      reason: "auth",
      notice: "connection_scope",
    });
  });

  it("an injected fetcher that THROWS still cannot fail the run", async () => {
    const deps = baseDeps({
      fetchInterfacePages: vi.fn(async () => {
        throw new Error("kaboom");
      }),
    });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.interfacePages).toEqual({ status: "skipped", reason: "transport" });
  });

  it("schema-only runs capture interfaces too (they are schema)", async () => {
    const deps = baseDeps({ fetchInterfacePages: vi.fn(async () => okCapture()) });
    const result = await runBackupBase({ ...INPUT, kind: "schema" as const }, deps);

    expect(result.status).toBe("succeeded");
    expect(result.recordsProcessed).toBe(0);
    expect(result.interfacePages).toEqual({ status: "captured" });
    expect(deps.syncSchema.mock.calls[0]![2]).toEqual({
      capturedAt: CAPTURED_AT,
      raw: ENVELOPE,
    });
  });
});
