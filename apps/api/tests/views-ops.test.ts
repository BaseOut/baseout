// Saved-view operations (api-views-tools): body contracts (create requires
// name+tableId+config; patch has NO tableId key), attribution threading, and
// the broker error mapping incl. table_locked passthrough. Broker + tenant
// guard are mocked — the broker's own guards are tested in apps/server.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/guards", () => ({
  requireSpace: vi.fn(async () => ({ orgId: "org_1", spaceId: "space_1" })),
  requireOrg: vi.fn(async () => "org_1"),
}));
vi.mock("../src/lib/server-client", () => ({
  serverClient: {
    viewsList: vi.fn(),
    viewsCreate: vi.fn(),
    viewGet: vi.fn(),
    viewUpdate: vi.fn(),
    viewDelete: vi.fn(),
  },
}));

import { serverClient } from "../src/lib/server-client";
import { createViewBody, updateViewBody, mapViewsBrokerError, viewOperations } from "../src/operations/views";
import { validateBodyValue } from "../src/lib/body";
import { ApiError } from "../src/lib/errors";
import type { OperationContext } from "../src/lib/registry";
import type { TokenGrant } from "../src/lib/auth";

const grant: TokenGrant = {
  id: "tok_1", organizationId: "org_1", spaceId: null,
  scopes: ["views:read", "views:write"], createdByUserId: "user_7",
};
const config = { tableId: "tbl1", hiddenCols: [], filterTree: { kind: "group", conjunction: "and", children: [] }, sortField: "", sortDir: 1, query: "", showRecId: false, colOrder: [] };

const ctx = (over: Partial<OperationContext> = {}): OperationContext =>
  ({
    db: {} as never, sql: {} as never, env: {} as never, ctx: {} as never,
    grant, params: { orgId: "org_1", spaceId: "space_1", viewId: "view_1" },
    query: new URLSearchParams(), body: undefined, requestId: "req_1",
    headers: new Headers(), now: new Date("2026-08-27T00:00:00Z"),
    ...over,
  }) as OperationContext;

const op = (method: string) => viewOperations.find((o) => o.method === method && (method === "GET" ? o.path.endsWith("{viewId}") : true))!;

beforeEach(() => vi.clearAllMocks());

describe("body contracts", () => {
  it("create requires name, tableId, and an object config", () => {
    expect(() => validateBodyValue(createViewBody, { name: "n", tableId: "t", config })).not.toThrow();
    expect(() => validateBodyValue(createViewBody, { name: "n", tableId: "t" })).toThrow(ApiError);
    expect(() => validateBodyValue(createViewBody, { name: "n", config })).toThrow(ApiError);
    expect(() => validateBodyValue(createViewBody, { name: "n", tableId: "t", config: [] })).toThrow(ApiError);
  });

  it("update accepts partial fields and rejects an empty patch", () => {
    expect(() => validateBodyValue(updateViewBody, { pinned: true })).not.toThrow();
    expect(() => validateBodyValue(updateViewBody, {})).toThrow(ApiError);
  });

  it("a tableId-ONLY patch passes validation so the broker answers table_locked (not empty-patch)", () => {
    expect(validateBodyValue(updateViewBody, { tableId: "tbl9" })).toEqual({ tableId: "tbl9" });
  });

  it("update passes a tableId key THROUGH to the broker (which rejects it as table_locked)", () => {
    // Deliberately passthrough — Zod's default stripping would silently ignore
    // the attempted move; the broker must see it and answer table_locked.
    const out = validateBodyValue(updateViewBody, { name: "x", tableId: "tbl9" }) as Record<string, unknown>;
    expect(out).toEqual({ name: "x", tableId: "tbl9" });
  });
});

describe("create — attribution + 201", () => {
  it("threads grant.createdByUserId and returns the created row", async () => {
    const row = { id: "v_1", name: "n", tableId: "t", config, pinned: false };
    vi.mocked(serverClient.viewsCreate).mockResolvedValue({ status: 201, body: { ok: true, view: row } });
    const createOp = viewOperations.find((o) => o.method === "POST")!;
    const res = await createOp.handler(ctx({ body: { name: "n", tableId: "t", config } }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(row);
    const payload = vi.mocked(serverClient.viewsCreate).mock.calls[0]![2] as Record<string, unknown>;
    expect(payload.createdByUserId).toBe("user_7");
  });
});

describe("broker error mapping", () => {
  it("404 → view_not_found; 400 table_locked passes through; other 400 generic", () => {
    expect(mapViewsBrokerError({ status: 404, body: { error: "view_not_found" } })).toMatchObject({ status: 404, code: "view_not_found" });
    expect(mapViewsBrokerError({ status: 400, body: { error: "table_locked" } })).toMatchObject({ status: 400, code: "table_locked" });
    expect(mapViewsBrokerError({ status: 400, body: { error: "invalid_request" } })).toMatchObject({ status: 400, code: "invalid_request" });
  });
  it("409/501/500/transport → 502", () => {
    for (const status of [409, 501, 500]) expect(mapViewsBrokerError({ status, body: {} }).status, String(status)).toBe(502);
    expect(mapViewsBrokerError(null).status).toBe(502);
  });
  it("a broker table_locked surfaces through the PATCH handler", async () => {
    vi.mocked(serverClient.viewUpdate).mockResolvedValue({ status: 400, body: { error: "table_locked" } });
    const patchOp = viewOperations.find((o) => o.method === "PATCH")!;
    await expect(patchOp.handler(ctx({ body: { name: "x" } }))).rejects.toMatchObject({ status: 400, code: "table_locked" });
  });
  it("a 404 broker response surfaces through GET", async () => {
    vi.mocked(serverClient.viewGet).mockResolvedValue({ status: 404, body: { error: "view_not_found" } });
    await expect(op("GET").handler(ctx())).rejects.toMatchObject({ status: 404, code: "view_not_found" });
  });
});

describe("list + delete envelopes", () => {
  it("list wraps broker views in the data envelope", async () => {
    vi.mocked(serverClient.viewsList).mockResolvedValue({ status: 200, body: { ok: true, views: [{ id: "v1" }] } });
    const listOp = viewOperations.find((o) => o.method === "GET" && o.path.endsWith("/views"))!;
    const res = await listOp.handler(ctx());
    expect(await res.json()).toEqual({ data: [{ id: "v1" }], pagination: { nextCursor: null } });
  });
  it("delete returns { id, deleted: true }", async () => {
    vi.mocked(serverClient.viewDelete).mockResolvedValue({ status: 200, body: { ok: true } });
    const delOp = viewOperations.find((o) => o.method === "DELETE")!;
    const res = await delOp.handler(ctx());
    expect(await res.json()).toEqual({ id: "view_1", deleted: true });
  });
});
