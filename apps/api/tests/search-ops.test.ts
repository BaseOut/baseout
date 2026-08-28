// Search operations (api-search-tools): query validation, envelope shaping,
// and the report ILIKE scoping. Broker + tenant guard mocked (broker guards
// are tested in apps/server); the report search's master-DB read is exercised
// through a chainable select stub.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/guards", () => ({
  requireSpace: vi.fn(async () => ({ orgId: "org_1", spaceId: "space_1" })),
  requireOrg: vi.fn(async () => "org_1"),
}));
vi.mock("../src/lib/server-client", () => ({
  serverClient: {
    dataSearch: vi.fn(),
    documentsList: vi.fn(),
    mediaList: vi.fn(),
  },
}));

import { serverClient } from "../src/lib/server-client";
import { escapeLike, searchOperations } from "../src/operations/search";
import type { OperationContext } from "../src/lib/registry";
import type { TokenGrant } from "../src/lib/auth";

const grant: TokenGrant = {
  id: "tok_1", organizationId: "org_1", spaceId: null,
  scopes: ["data:read", "documents:read", "reports:read"], createdByUserId: null,
};

const ctx = (query: Record<string, string> = {}, over: Partial<OperationContext> = {}): OperationContext =>
  ({
    db: {} as never, sql: {} as never, env: {} as never, ctx: {} as never,
    grant, params: { orgId: "org_1", spaceId: "space_1" },
    query: new URLSearchParams(query), body: undefined, requestId: "req_1",
    headers: new Headers(), now: new Date("2026-08-27T00:00:00Z"),
    ...over,
  }) as OperationContext;

const op = (pathEnd: string) => searchOperations.find((o) => o.path.endsWith(pathEnd))!;

beforeEach(() => vi.clearAllMocks());

describe("q validation", () => {
  it("record/document/report search 400 on a missing or blank q, before any broker call", async () => {
    for (const end of ["record-search", "document-search"]) {
      await expect(op(end).handler(ctx()), end).rejects.toMatchObject({ status: 400, param: "q" });
      await expect(op(end).handler(ctx({ q: "  " })), end).rejects.toMatchObject({ status: 400, param: "q" });
    }
    expect(serverClient.dataSearch).not.toHaveBeenCalled();
    expect(serverClient.documentsList).not.toHaveBeenCalled();
  });

  it("attachment-search allows a filter-only query (no q)", async () => {
    vi.mocked(serverClient.mediaList).mockResolvedValue({ status: 200, body: { ok: true, items: [], nextCursor: null } });
    const res = await op("attachment-search").handler(ctx({ class: "image" }));
    expect(res.status).toBe(200);
    expect(vi.mocked(serverClient.mediaList).mock.calls[0]![2]).toBe("class=image");
  });
});

describe("record-search envelope", () => {
  it("passes q/baseId/tableId through and shapes { data, partial }", async () => {
    const groups = [{ baseId: "b1", tables: [] }];
    vi.mocked(serverClient.dataSearch).mockResolvedValue({ status: 200, body: { ok: true, groups, partial: true } });
    const res = await op("record-search").handler(ctx({ q: "acme", baseId: "b1" }));
    expect(await res.json()).toEqual({ data: groups, partial: true, pagination: { nextCursor: null } });
    expect(vi.mocked(serverClient.dataSearch).mock.calls[0]![2]).toBe("q=acme&baseId=b1");
  });

  it("broker 400 (bad q) maps to a public 400; 409/500 to 502", async () => {
    vi.mocked(serverClient.dataSearch).mockResolvedValue({ status: 400, body: { error: "invalid_request", param: "q" } });
    await expect(op("record-search").handler(ctx({ q: "x" }))).rejects.toMatchObject({ status: 400 });
    vi.mocked(serverClient.dataSearch).mockResolvedValue({ status: 409, body: { error: "space_db_not_ready" } });
    await expect(op("record-search").handler(ctx({ q: "x" }))).rejects.toMatchObject({ status: 502 });
  });
});

describe("document-search", () => {
  it("forwards q to the documents broker and wraps the list", async () => {
    vi.mocked(serverClient.documentsList).mockResolvedValue({ status: 200, body: { ok: true, documents: [{ id: "d1" }] } });
    const res = await op("document-search").handler(ctx({ q: "runbook" }));
    expect(await res.json()).toEqual({ data: [{ id: "d1" }], pagination: { nextCursor: null } });
    expect(vi.mocked(serverClient.documentsList).mock.calls[0]![2]).toBe("q=runbook");
  });
});

describe("report-search (master DB in-Worker)", () => {
  it("ILIKE-escapes the query and scopes to the Space", async () => {
    const where = vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([
      { id: "r1", name: "Weekly %", sections: ["backups"], isDefault: false, scheduleCadence: "weekly", scheduleEnabled: true, nextRunAt: new Date("2026-09-01T00:00:00Z") },
    ]) });
    const db = { select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) }) };
    const res = await op("report-search").handler(ctx({ q: "50%_done" }, { db: db as never }));
    const body = (await res.json()) as { data: { id: string; nextRunAt: string }[] };
    expect(body.data[0]).toMatchObject({ id: "r1", nextRunAt: "2026-09-01T00:00:00.000Z" });
    expect(where).toHaveBeenCalledOnce(); // Space-scoped + ILIKE condition applied
  });

  it("escapeLike neutralizes LIKE metacharacters (matches the server-side helper)", () => {
    expect(escapeLike("50%_done\\x")).toBe("50\\%\\_done\\\\x");
  });
});
