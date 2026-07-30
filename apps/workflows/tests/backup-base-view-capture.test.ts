// Tests for the MCP views capture step in runBackupBase
// (workflows-mcp-views tasks 2.1–2.3). Mirrors the harness in
// backup-base-interface-capture.test.ts.
//
// The spec's hard rules exercised here:
//   - viewCaptureMode 'mcp' captures views per table and rides the schema-sync
//     POST as the optional `views` field,
//   - 'rest' / 'off' / absent make ZERO MCP view requests and 'rest' behaves
//     exactly as before this change (field absent from schema-sync),
//   - NO view-capture failure mode may change the backup run's outcome,
//   - a skipped capture OMITS the field from schema-sync (absent ≠ deleted),
//   - the capture is independent from the interface-pages and automations
//     captures (isolation both ways).

import { describe, expect, it, vi, type Mock } from "vitest";
import { runBackupBase, type BackupBaseDeps } from "../trigger/tasks/backup-base";
import type {
  FetchAutomationsResult,
  FetchInterfacePagesResult,
  FetchViewsResult,
  ViewsCapture,
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
    {
      id: "tbl2",
      name: "Projects",
      primaryFieldId: "f2",
      fields: [{ id: "f2", name: "Title", type: "singleLineText" }],
      views: [],
    },
  ],
};

const PAGES: AirtableRecordsPage[] = [
  { records: [{ id: "rec1", createdTime: "2026-01-01T00:00:00Z", fields: { Name: "A" } }] },
  { records: [] },
];

function makeClient(schema: AirtableSchema = SCHEMA) {
  let i = 0;
  return {
    listBases: vi.fn(),
    getBaseSchema: vi.fn(async () => schema),
    listRecords: vi.fn(async () => PAGES[i++] ?? { records: [] }),
  };
}

const CAPTURE: ViewsCapture = {
  capturedAt: "2026-07-27T10:00:00.000Z",
  tables: [
    { tableId: "tbl1", raw: { views: [{ id: "viwA", name: "Grid view", type: "grid" }] } },
    { tableId: "tbl2", raw: { views: [{ id: "viwB", name: "Kanban", type: "kanban" }] } },
  ],
};

const okCapture = (): FetchViewsResult => ({ ok: true, capture: CAPTURE });

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
  viewCaptureMode: "mcp" as const,
};

type SyncSchemaMock = Mock<NonNullable<BackupBaseDeps["syncSchema"]>>;
type FetchViewsMock = Mock<NonNullable<BackupBaseDeps["fetchViews"]>>;

const baseDeps = (
  over: Partial<BackupBaseDeps>,
): BackupBaseDeps & { syncSchema: SyncSchemaMock; fetchViews?: FetchViewsMock } => ({
  engineUrl: ENGINE,
  internalToken: TOKEN,
  fetchImpl: makeFetchMock(),
  airtableClient: makeClient(),
  writeCsv: vi.fn(async () => ({})),
  syncSchema: vi.fn(async () => ({ recordsEnabled: false, baseRunId: "br-1" })) as SyncSchemaMock,
  ...over,
} as BackupBaseDeps & { syncSchema: SyncSchemaMock; fetchViews?: FetchViewsMock });

describe("runBackupBase — MCP views capture", () => {
  it("mcp mode: capture rides the schema-sync POST (5th arg) and reports captured", async () => {
    const deps = baseDeps({ fetchViews: vi.fn(async () => okCapture()) });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.views).toEqual({ status: "captured" });
    // Table ids come from the schema fetch result — every captured table.
    expect(deps.fetchViews).toHaveBeenCalledWith({
      baseId: "appXYZ",
      tableIds: ["tbl1", "tbl2"],
      accessToken: "pt-cipher",
    });
    expect(deps.syncSchema).toHaveBeenCalledTimes(1);
    expect(deps.syncSchema.mock.calls[0]![4]).toEqual(CAPTURE);
  });

  it("rest mode: ZERO MCP view calls, schema-sync body matches pre-change behavior", async () => {
    const fetchViews = vi.fn(async () => okCapture());
    const deps = baseDeps({ fetchViews });
    const result = await runBackupBase({ ...INPUT, viewCaptureMode: "rest" as const }, deps);

    expect(fetchViews).not.toHaveBeenCalled();
    expect(result.status).toBe("succeeded");
    expect(result.views).toBeUndefined();
    expect(deps.syncSchema.mock.calls[0]![4]).toBeUndefined();
  });

  it("off mode: ZERO MCP view calls, no views field, no outcome", async () => {
    const fetchViews = vi.fn(async () => okCapture());
    const deps = baseDeps({ fetchViews });
    const result = await runBackupBase({ ...INPUT, viewCaptureMode: "off" as const }, deps);

    expect(fetchViews).not.toHaveBeenCalled();
    expect(result.views).toBeUndefined();
    expect(deps.syncSchema.mock.calls[0]![4]).toBeUndefined();
  });

  it("mode absent entirely (older engine payload) → zero MCP view calls", async () => {
    const fetchViews = vi.fn(async () => okCapture());
    const { viewCaptureMode: _drop, ...withoutMode } = INPUT;
    const result = await runBackupBase(withoutMode, baseDeps({ fetchViews }));

    expect(fetchViews).not.toHaveBeenCalled();
    expect(result.views).toBeUndefined();
  });

  it("no syncSchema wired → capture has nowhere to land, zero MCP view calls", async () => {
    const fetchViews = vi.fn(async () => okCapture());
    const deps = baseDeps({ syncSchema: undefined, fetchViews });
    const result = await runBackupBase(INPUT, deps);

    expect(fetchViews).not.toHaveBeenCalled();
    expect(result.status).toBe("succeeded");
    expect(result.views).toBeUndefined();
  });

  it.each<[string, FetchViewsResult]>([
    ["timeout", { ok: false, reason: "timeout" }],
    ["http_503", { ok: false, reason: "http_503" }],
    ["invalid_envelope", { ok: false, reason: "invalid_envelope" }],
    ["payload_too_large", { ok: false, reason: "payload_too_large" }],
  ])("skipped(%s): run outcome untouched, field OMITTED from schema-sync", async (_label, capture) => {
    const deps = baseDeps({ fetchViews: vi.fn(async () => capture) });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.tablesProcessed).toBe(2);
    expect(result.views).toEqual({
      status: "skipped",
      reason: (capture as { reason: string }).reason,
    });
    // Field omitted — the engine must never interpret a skip as a deletion.
    expect(deps.syncSchema).toHaveBeenCalledTimes(1);
    expect(deps.syncSchema.mock.calls[0]![4]).toBeUndefined();
  });

  it("401 (auth) additionally surfaces the connection-scope notice", async () => {
    const deps = baseDeps({
      fetchViews: vi.fn(async (): Promise<FetchViewsResult> => ({ ok: false, reason: "auth" })),
    });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.views).toEqual({
      status: "skipped",
      reason: "auth",
      notice: "connection_scope",
    });
  });

  it("an injected fetcher that THROWS still cannot fail the run", async () => {
    const deps = baseDeps({
      fetchViews: vi.fn(async () => {
        throw new Error("kaboom");
      }),
    });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.views).toEqual({ status: "skipped", reason: "transport" });
  });

  it("view-capture failure does not disturb the interface + automation captures (or vice versa)", async () => {
    const IF_ENVELOPE = { interfaces: [{ id: "pbdX" }], standaloneForms: [] };
    const AUTO_ENVELOPE = { automations: [{ id: "wflX" }] };
    const deps = baseDeps({
      fetchViews: vi.fn(async (): Promise<FetchViewsResult> => ({ ok: false, reason: "timeout" })),
      fetchInterfacePages: vi.fn(
        async (): Promise<FetchInterfacePagesResult> => ({
          ok: true,
          raw: IF_ENVELOPE,
          capturedAt: "2026-07-27T10:00:00.000Z",
        }),
      ),
      fetchAutomations: vi.fn(
        async (): Promise<FetchAutomationsResult> => ({
          ok: true,
          raw: AUTO_ENVELOPE,
          capturedAt: "2026-07-27T10:00:00.000Z",
        }),
      ),
    });
    const result = await runBackupBase(
      { ...INPUT, interfacesEnabled: true, automationsEnabled: true },
      deps,
    );

    expect(result.status).toBe("succeeded");
    expect(result.interfacePages).toEqual({ status: "captured" });
    expect(result.automations).toEqual({ status: "captured" });
    expect(result.views).toEqual({ status: "skipped", reason: "timeout" });
    // Schema-sync carries the two successful captures WITHOUT views.
    expect(deps.syncSchema.mock.calls[0]![2]).toEqual({
      capturedAt: "2026-07-27T10:00:00.000Z",
      raw: IF_ENVELOPE,
    });
    expect(deps.syncSchema.mock.calls[0]![3]).toEqual({
      capturedAt: "2026-07-27T10:00:00.000Z",
      raw: AUTO_ENVELOPE,
    });
    expect(deps.syncSchema.mock.calls[0]![4]).toBeUndefined();
  });

  it("schema-only runs capture views too (they are schema)", async () => {
    const deps = baseDeps({ fetchViews: vi.fn(async () => okCapture()) });
    const result = await runBackupBase({ ...INPUT, kind: "schema" as const }, deps);

    expect(result.status).toBe("succeeded");
    expect(result.recordsProcessed).toBe(0);
    expect(result.views).toEqual({ status: "captured" });
    expect(deps.syncSchema.mock.calls[0]![4]).toEqual(CAPTURE);
  });

  it("trial-truncated runs still capture views for ALL schema tables (matching schema-sync)", async () => {
    const manyTables: AirtableSchema = {
      tables: Array.from({ length: 7 }, (_, i) => ({
        id: `tbl${i + 1}`,
        name: `T${i + 1}`,
        primaryFieldId: "f1",
        fields: [{ id: "f1", name: "Name", type: "singleLineText" }],
        views: [],
      })),
    };
    const fetchViews = vi.fn(async () => okCapture());
    const deps = baseDeps({ airtableClient: makeClient(manyTables), fetchViews });
    const result = await runBackupBase({ ...INPUT, isTrial: true }, deps);

    expect(result.status).toBe("trial_truncated");
    // schema-sync sends the FULL schema; the views capture must cover the
    // same table set (all-or-skip = full sighting server-side).
    expect(fetchViews).toHaveBeenCalledWith({
      baseId: "appXYZ",
      tableIds: ["tbl1", "tbl2", "tbl3", "tbl4", "tbl5", "tbl6", "tbl7"],
      accessToken: "pt-cipher",
    });
  });
});
