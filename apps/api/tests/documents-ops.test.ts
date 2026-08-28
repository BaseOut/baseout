// Document operations (api-documents-tools): body contract (markdown XOR
// Plate body), markdown conversion + attribution threading into the broker
// payload, and the D6 broker-error mapping. Broker + tenant guard are mocked —
// the real broker's guards are tested in apps/server.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/guards", () => ({
  requireSpace: vi.fn(async () => ({ orgId: "org_1", spaceId: "space_1" })),
  requireOrg: vi.fn(async () => "org_1"),
}));
vi.mock("../src/lib/server-client", () => ({
  serverClient: {
    documentsList: vi.fn(),
    documentsCreate: vi.fn(),
    documentGet: vi.fn(),
    documentUpdate: vi.fn(),
    documentDelete: vi.fn(),
    docsByEntity: vi.fn(),
    documentTagAdd: vi.fn(),
    documentTagRemove: vi.fn(),
  },
}));

import { serverClient } from "../src/lib/server-client";
import {
  createDocumentBody,
  updateDocumentBody,
  mapBrokerError,
  resolveBodyInput,
  documentOperations,
} from "../src/operations/documents";
import { validateBodyValue } from "../src/lib/body";
import { ApiError } from "../src/lib/errors";
import type { OperationContext } from "../src/lib/registry";
import type { TokenGrant } from "../src/lib/auth";

const grant: TokenGrant = {
  id: "tok_1", organizationId: "org_1", spaceId: null,
  scopes: ["documents:read", "documents:write"], createdByUserId: "user_42",
};

const ctx = (over: Partial<OperationContext> = {}): OperationContext =>
  ({
    db: {} as never, sql: {} as never, env: {} as never, ctx: {} as never,
    grant, params: { orgId: "org_1", spaceId: "space_1", documentId: "doc_1" },
    query: new URLSearchParams(), body: undefined, requestId: "req_1",
    headers: new Headers(), now: new Date("2026-08-27T00:00:00Z"),
    ...over,
  }) as OperationContext;

const op = (method: string, path: string) =>
  documentOperations.find((o) => o.method === method && o.path.endsWith(path))!;

beforeEach(() => vi.clearAllMocks());

describe("body contract — markdown XOR Plate body", () => {
  it("accepts markdown alone and body alone", () => {
    expect(() => validateBodyValue(createDocumentBody, { title: "T", markdown: "hi" })).not.toThrow();
    expect(() => validateBodyValue(createDocumentBody, { title: "T", body: [{ type: "p", children: [{ text: "x" }] }] })).not.toThrow();
  });

  it("rejects markdown AND body together (create + update)", () => {
    for (const schema of [createDocumentBody, updateDocumentBody]) {
      try {
        validateBodyValue(schema, { title: "T", markdown: "hi", body: [] });
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).code).toBe("invalid_body");
        expect((err as ApiError).message).toContain("not both");
      }
    }
  });

  it("rejects a create without a title", () => {
    expect(() => validateBodyValue(createDocumentBody, { markdown: "hi" })).toThrow(ApiError);
  });
});

describe("resolveBodyInput — markdown conversion", () => {
  it("converts markdown to a Plate body and drops the markdown key", () => {
    const out = resolveBodyInput({ title: "T", markdown: "**hey**" });
    expect(out).toEqual({ title: "T", body: [{ type: "p", children: [{ text: "hey", bold: true }] }] });
  });
  it("passes an explicit Plate body through untouched", () => {
    const body = [{ type: "p", children: [{ text: "x" }] }];
    expect(resolveBodyInput({ title: "T", body })).toEqual({ title: "T", body });
  });
  it("leaves body absent when neither is provided (update semantics)", () => {
    expect(resolveBodyInput({ title: "T" })).toEqual({ title: "T" });
  });
});

describe("create — attribution + canonical 201", () => {
  it("threads grant.createdByUserId into the broker payload and returns 201 with the document", async () => {
    const doc = { id: "doc_9", title: "T", tags: [] };
    vi.mocked(serverClient.documentsCreate).mockResolvedValue({ status: 201, body: { ok: true, document: doc } });
    const res = await op("POST", "/documents").handler(ctx({ body: { title: "T", markdown: "hello" } }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(doc);
    const payload = vi.mocked(serverClient.documentsCreate).mock.calls[0]![2] as Record<string, unknown>;
    expect(payload.createdByUserId).toBe("user_42");
    expect(payload.body).toEqual([{ type: "p", children: [{ text: "hello" }] }]);
    expect(payload).not.toHaveProperty("markdown");
  });
});

describe("broker error mapping (D6)", () => {
  it("404 passes through with the broker's code", () => {
    const e = mapBrokerError({ status: 404, body: { error: "tag_not_found" } });
    expect(e.status).toBe(404);
    expect(e.code).toBe("tag_not_found");
    expect(mapBrokerError({ status: 404, body: { error: "document_not_found" } }).code).toBe("document_not_found");
  });
  it("400 → public 400; 409/501/500/transport → 502", () => {
    expect(mapBrokerError({ status: 400, body: {} }).status).toBe(400);
    for (const status of [409, 501, 500]) expect(mapBrokerError({ status, body: {} }).status, String(status)).toBe(502);
    expect(mapBrokerError(null).status).toBe(502);
  });

  it("a 404 broker response surfaces through a handler", async () => {
    vi.mocked(serverClient.documentGet).mockResolvedValue({ status: 404, body: { error: "document_not_found" } });
    await expect(op("GET", "/documents/{documentId}").handler(ctx())).rejects.toMatchObject({
      status: 404, code: "document_not_found",
    });
  });
});

describe("entity-documents + untag query validation", () => {
  it("entity-documents rejects a bad targetType before calling the broker", async () => {
    const c = ctx({ query: new URLSearchParams({ targetType: "space", targetId: "x" }) });
    await expect(op("GET", "/entity-documents").handler(c)).rejects.toMatchObject({ status: 400, param: "targetType" });
    expect(serverClient.docsByEntity).not.toHaveBeenCalled();
  });

  it("untag requires both query params", async () => {
    const c = ctx({ query: new URLSearchParams({ targetType: "field" }) });
    await expect(op("DELETE", "/tags").handler(c)).rejects.toMatchObject({ status: 400, param: "targetId" });
  });

  it("entity-documents returns the list envelope with entityRemoved", async () => {
    vi.mocked(serverClient.docsByEntity).mockResolvedValue({
      status: 200,
      body: { ok: true, entityRemoved: true, documents: [{ documentId: "d1" }] },
    });
    const c = ctx({ query: new URLSearchParams({ targetType: "field", targetId: "fld1" }) });
    const res = await op("GET", "/entity-documents").handler(c);
    expect(await res.json()).toEqual({
      data: [{ documentId: "d1" }],
      pagination: { nextCursor: null },
      entityRemoved: true,
    });
  });
});
