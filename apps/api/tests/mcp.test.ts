import { describe, expect, it } from "vitest";
import { operations } from "../src/operations";
import { MCP_TOOLS } from "../src/mcp/tools";
import { buildToolCatalog, opForTool, toolInputSchema } from "../src/mcp/catalog";
import { callTool, type DispatchDeps } from "../src/mcp/dispatch";
import type { Operation } from "../src/lib/registry";
import type { TokenGrant } from "../src/lib/auth";
import { ApiError } from "../src/lib/errors";

const orgWide: TokenGrant = { id: "t", organizationId: "org_1", spaceId: null, scopes: ["org:read", "backups:read", "schema:read"] };
const spaceBound: TokenGrant = { ...orgWide, spaceId: "space_1" };

describe("MCP ↔ REST contract", () => {
  it("every MCP tool resolves to a real registry operation (no drift)", () => {
    for (const t of MCP_TOOLS) {
      expect(opForTool(operations, t), `${t.name} → ${t.method} ${t.path}`).toBeDefined();
    }
  });
  it("tool names are unique", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("catalog — scope filter + grant-aware spaceId", () => {
  it("omits tools whose operation scope the token lacks", () => {
    const backupsOnly = buildToolCatalog(operations, { ...orgWide, scopes: ["backups:read"] });
    const names = backupsOnly.map((t) => t.name);
    expect(names).toContain("list_backup_runs");
    expect(names).not.toContain("search_schema"); // schema:read missing
    expect(names).not.toContain("get_org"); // org:read missing
  });

  it("org-wide token → spaceId is a required arg on Space-scoped tools", () => {
    const search = MCP_TOOLS.find((t) => t.name === "search_schema")!;
    const schema = toolInputSchema(search, orgWide) as { properties: Record<string, unknown>; required: string[] };
    expect(schema.properties.spaceId).toBeDefined();
    expect(schema.required).toContain("spaceId");
  });

  it("Space-bound token → spaceId is elided (injected, not an arg)", () => {
    const search = MCP_TOOLS.find((t) => t.name === "search_schema")!;
    const schema = toolInputSchema(search, spaceBound) as { properties: Record<string, unknown>; required: string[] };
    expect(schema.properties.spaceId).toBeUndefined();
    expect(schema.required).not.toContain("spaceId");
  });

  it("all tools are read-only", () => {
    for (const t of buildToolCatalog(operations, orgWide)) expect(t.annotations.readOnlyHint).toBe(true);
  });
});

describe("dispatch — in-process arg mapping + error parity", () => {
  const stubDeps = (handler: Operation["handler"], grant = orgWide, path = "/v1/orgs/{orgId}/spaces", method: "GET" | "POST" = "GET"): DispatchDeps => ({
    operations: [{ method, path, scope: "org:read", summary: "", handler }],
    db: {} as never, sql: {} as never, env: {} as never, ctx: {} as never,
    grant, now: new Date("2026-07-20T00:00:00Z"), requestId: "req_1",
  });

  it("injects orgId + maps args to query, returns the handler body as tool text", async () => {
    const seen: { params?: Record<string, string>; query?: string } = {};
    const r = await callTool("list_spaces", { limit: 25 }, stubDeps((c) => {
      seen.params = c.params; seen.query = c.query.toString();
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }));
    expect(r.isError).toBeFalsy();
    expect(seen.params).toEqual({ orgId: "org_1" });
    expect(seen.query).toBe("limit=25");
    expect(r.content[0].text).toBe(JSON.stringify({ ok: true }));
  });

  it("injects spaceId for a Space-bound token on a Space-scoped tool", async () => {
    let injected: string | undefined;
    await callTool("get_backup_status", {}, stubDeps((c) => {
      injected = c.params.spaceId;
      return new Response("{}", { status: 200 });
    }, spaceBound, "/v1/orgs/{orgId}/spaces/{spaceId}/backups/status"));
    expect(injected).toBe("space_1");
  });

  it("org-wide token missing spaceId → tool error (not a crash)", async () => {
    const r = await callTool("get_backup_status", {}, stubDeps(() => new Response("{}"), orgWide, "/v1/orgs/{orgId}/spaces/{spaceId}/backups/status"));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("spaceId");
  });

  it("a non-2xx handler response → isError with the body (REST parity)", async () => {
    const r = await callTool("list_spaces", {}, stubDeps(() => new Response(JSON.stringify({ error: { code: "org_not_found" } }), { status: 404 })));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("org_not_found");
  });

  it("a thrown ApiError → isError with the mapped code", async () => {
    const r = await callTool("list_spaces", {}, stubDeps(() => { throw new ApiError("forbidden", "insufficient_scope", "nope"); }));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("insufficient_scope");
  });

  it("unknown tool → tool error", async () => {
    const r = await callTool("does_not_exist", {}, stubDeps(() => new Response("{}")));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("unknown_tool");
  });
});
