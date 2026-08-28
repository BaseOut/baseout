// MCP write conventions + dispatch hardening (api-write-foundation tasks 3.1,
// 3.3, 4.1–4.3): path params derived from the operation's path template (no
// hardcoded list), the platform constant, tool-declared body/query arg split,
// mutation results as MCP content, and readOnlyHint/destructiveHint accuracy.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DEFAULT_PLATFORM } from "../src/lib/platform";
import { callTool, type DispatchDeps } from "../src/mcp/dispatch";
import { buildToolCatalog } from "../src/mcp/catalog";
import type { McpToolDef } from "../src/mcp/tools";
import type { Operation } from "../src/lib/registry";
import type { TokenGrant } from "../src/lib/auth";

const orgWide: TokenGrant = { id: "t", organizationId: "org_1", spaceId: null, scopes: ["org:read", "views:write", "documents:write"], createdByUserId: "user_1" };
const spaceBound: TokenGrant = { ...orgWide, spaceId: "space_1" };

/** Deps with a custom tool + operation pair (tools override for test-only tools). */
const depsFor = (tools: McpToolDef[], ops: Operation[], grant = orgWide): DispatchDeps => ({
  operations: ops,
  tools,
  db: {} as never, sql: {} as never, env: {} as never, ctx: {} as never,
  grant, now: new Date("2026-08-27T00:00:00Z"), requestId: "req_1",
});

describe("platform constant (task 3.3)", () => {
  it("is the single 'at' default", () => {
    expect(DEFAULT_PLATFORM).toBe("at");
  });
});

describe("derived path params (task 3.1)", () => {
  it("an operation with a novel {whateverId} param round-trips through a tool call", async () => {
    const seen: { params?: Record<string, string>; query?: string } = {};
    const tool: McpToolDef = { name: "get_widget", description: "", method: "GET", path: "/v1/orgs/{orgId}/widgets/{whateverId}", argProps: { whateverId: { type: "string" } }, required: ["whateverId"] };
    const op: Operation = {
      method: "GET", path: tool.path, scope: "org:read", summary: "",
      handler: (c) => { seen.params = c.params; seen.query = c.query.toString(); return new Response("{}"); },
    };
    const r = await callTool("get_widget", { whateverId: "w_9", limit: 5 }, depsFor([tool], [op]));
    expect(r.isError).toBeFalsy();
    expect(seen.params).toEqual({ orgId: "org_1", whateverId: "w_9" });
    expect(seen.query).toBe("limit=5"); // path param not duplicated into query
  });

  it("platform is injected from the constant when the path has {platform}", async () => {
    let injected: string | undefined;
    const tool: McpToolDef = { name: "list_things", description: "", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/things", argProps: {} };
    const op: Operation = { method: "GET", path: tool.path, scope: "org:read", summary: "", handler: (c) => { injected = c.params.platform; return new Response("{}"); } };
    await callTool("list_things", {}, depsFor([tool], [op], spaceBound));
    expect(injected).toBe(DEFAULT_PLATFORM);
  });
});

describe("body/query arg split (task 4.1)", () => {
  const patchTool: McpToolDef = {
    name: "update_document", description: "", method: "PATCH",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{docId}",
    argProps: { docId: { type: "string" }, title: { type: "string" }, content: { type: "string" } },
    required: ["docId"],
    bodyArgs: ["title", "content"],
  };

  it("routes declared bodyArgs to the JSON body, path args to params, the rest to query", async () => {
    const seen: { params?: Record<string, string>; query?: string; body?: unknown } = {};
    const op: Operation = {
      method: "PATCH", path: patchTool.path, scope: "documents:write", summary: "",
      bodySchema: z.object({ title: z.string().optional(), content: z.string().optional() }),
      handler: (c) => { seen.params = c.params; seen.query = c.query.toString(); seen.body = c.body; return new Response(JSON.stringify({ id: "doc_1" })); },
    };
    const r = await callTool("update_document", { docId: "doc_1", title: "T", content: "C", dryRun: true }, depsFor([patchTool], [op], spaceBound));
    expect(r.isError).toBeFalsy();
    expect(seen.params).toMatchObject({ orgId: "org_1", spaceId: "space_1", docId: "doc_1" });
    expect(seen.body).toEqual({ title: "T", content: "C" });
    expect(seen.query).toBe("dryRun=true");
  });

  it('bodyArgs: "all" sends every non-path arg as the body (search_schema shape)', async () => {
    let body: unknown;
    const tool: McpToolDef = { name: "search_x", description: "", method: "POST", path: "/v1/orgs/{orgId}/spaces/{spaceId}/x/search", argProps: { query: { type: "string" } }, bodyArgs: "all" };
    const op: Operation = { method: "POST", path: tool.path, scope: "org:read", summary: "", handler: (c) => { body = c.body; return new Response("{}"); } };
    await callTool("search_x", { query: "q", limit: 10 }, depsFor([tool], [op], spaceBound));
    expect(body).toEqual({ query: "q", limit: 10 });
  });

  it("MCP body passes through the operation's bodySchema validation (invalid → isError, not a crash)", async () => {
    const tool: McpToolDef = { name: "update_document", description: "", method: "PATCH", path: "/v1/x/{orgId}", argProps: { title: { type: "string" } }, bodyArgs: ["title"] };
    const op: Operation = {
      method: "PATCH", path: tool.path, scope: "documents:write", summary: "",
      bodySchema: z.object({ title: z.string() }),
      handler: () => new Response("{}"),
    };
    const r = await callTool("update_document", { title: 42 }, depsFor([tool], [op]));
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toContain("invalid_body");
  });
});

describe("mutation results as MCP content (task 4.2)", () => {
  const tool: McpToolDef = { name: "update_thing", description: "", method: "PATCH", path: "/v1/things/{orgId}", argProps: {}, bodyArgs: "all" };

  it("returns the canonical resource representation as tool text", async () => {
    const op: Operation = { method: "PATCH", path: tool.path, scope: "org:read", summary: "", handler: () => new Response(JSON.stringify({ id: "th_1", name: "renamed" }), { status: 200 }) };
    const r = await callTool("update_thing", {}, depsFor([tool], [op]));
    expect(r.isError).toBeFalsy();
    expect(JSON.parse(r.content[0]!.text)).toEqual({ id: "th_1", name: "renamed" });
  });

  it("non-2xx mutation → isError envelope (REST parity)", async () => {
    const op: Operation = { method: "PATCH", path: tool.path, scope: "org:read", summary: "", handler: () => new Response(JSON.stringify({ error: { code: "doc_not_found" } }), { status: 404 }) };
    const r = await callTool("update_thing", {}, depsFor([tool], [op]));
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toContain("doc_not_found");
  });
});

describe("annotation accuracy (task 4.3)", () => {
  const ops: Operation[] = [
    { method: "GET", path: "/v1/a/{orgId}", scope: "org:read", summary: "", handler: () => new Response("{}") },
    { method: "PATCH", path: "/v1/a/{orgId}", scope: "views:write", summary: "", handler: () => new Response("{}") },
    { method: "DELETE", path: "/v1/a/{orgId}", scope: "views:write", summary: "", handler: () => new Response("{}") },
    { method: "POST", path: "/v1/a/{orgId}/search", scope: "org:read", summary: "", handler: () => new Response("{}") },
  ];
  const tools: McpToolDef[] = [
    { name: "get_a", description: "", method: "GET", path: "/v1/a/{orgId}", argProps: {} },
    { name: "update_a", description: "", method: "PATCH", path: "/v1/a/{orgId}", argProps: {}, bodyArgs: "all" },
    { name: "delete_a", description: "", method: "DELETE", path: "/v1/a/{orgId}", argProps: {} },
    { name: "search_a", description: "", method: "POST", path: "/v1/a/{orgId}/search", argProps: {}, bodyArgs: "all", readOnly: true },
  ];

  it("GET → readOnly; PATCH → not readOnly; DELETE → destructive; POST read override honored", () => {
    const catalog = buildToolCatalog(ops, orgWide, tools);
    const byName = Object.fromEntries(catalog.map((t) => [t.name, t.annotations]));
    expect(byName.get_a).toEqual({ readOnlyHint: true });
    expect(byName.update_a).toEqual({ readOnlyHint: false });
    expect(byName.delete_a).toEqual({ readOnlyHint: false, destructiveHint: true });
    expect(byName.search_a).toEqual({ readOnlyHint: true });
  });
});

describe("document tools — real defs through dispatch (api-documents-tools 4.2)", () => {
  const docGrant: TokenGrant = { ...spaceBound, scopes: ["documents:read", "documents:write"] };
  const stubOp = (method: Operation["method"], path: string, handler: Operation["handler"], bodySchema?: Operation["bodySchema"]): Operation =>
    ({ method, path, scope: "documents:write", summary: "", bodySchema, handler });

  it("tag_document: documentId → path, tag fields → body", async () => {
    const seen: { params?: Record<string, string>; body?: unknown } = {};
    const op = stubOp("POST", "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{documentId}/tags", (c) => {
      seen.params = c.params; seen.body = c.body; return new Response("{}");
    });
    const r = await callTool("tag_document", { documentId: "doc_1", targetType: "field", targetId: "fld1" }, { ...depsFor([], [op], docGrant), tools: undefined });
    expect(r.isError).toBeFalsy();
    expect(seen.params).toMatchObject({ documentId: "doc_1", spaceId: "space_1" });
    expect(seen.body).toEqual({ targetType: "field", targetId: "fld1" });
  });

  it("untag_document: DELETE with the pair as query args", async () => {
    let query = "";
    const op = stubOp("DELETE", "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{documentId}/tags", (c) => {
      query = c.query.toString(); return new Response("{}");
    });
    const r = await callTool("untag_document", { documentId: "doc_1", targetType: "field", targetId: "fld1" }, { ...depsFor([], [op], docGrant), tools: undefined });
    expect(r.isError).toBeFalsy();
    expect(query).toBe("targetType=field&targetId=fld1");
  });

  it("create_document: markdown+body together is rejected by the operation's bodySchema", async () => {
    const { createDocumentBody } = await import("../src/operations/documents");
    const op = stubOp("POST", "/v1/orgs/{orgId}/spaces/{spaceId}/documents", () => new Response("{}"), createDocumentBody);
    const r = await callTool("create_document", { title: "T", markdown: "x", body: [] }, { ...depsFor([], [op], docGrant), tools: undefined });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toContain("invalid_body");
  });
});
