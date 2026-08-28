// MCP tool catalog contract (api-mcp §1.3). Pins the zero-drift invariants:
// every tool def resolves to a real registry operation AND every operation has
// an explicit MCP decision; tool names are stable (additive-only — the
// snapshot fails on rename/removal); grant-aware elision per design D5; all
// tools read-only.
import { describe, expect, test } from "vitest";

import { operations } from "../src/operations";
import { buildToolCatalog, opForTool } from "../src/mcp/catalog";
import { MCP_TOOLS } from "../src/mcp/tools";
import type { TokenGrant } from "../src/lib/auth";

const ALL_SCOPES = ["org:read", "backups:read", "schema:read", "documents:read", "documents:write", "views:read", "views:write", "data:read", "reports:read"];
const orgWide: TokenGrant = { id: "tok-1", organizationId: "org-1", spaceId: null, scopes: ALL_SCOPES, createdByUserId: null };
const spaceBound: TokenGrant = { ...orgWide, spaceId: "spc-1" };

// Additive-only stability policy: renaming or removing a tool is breaking and
// fails here. Adding a tool = extend this list in the same change.
const EXPECTED_TOOLS = [
  "get_org",
  "list_spaces",
  "get_space",
  "list_platforms",
  "list_backup_runs",
  "get_backup_run",
  "get_backup_configuration",
  "get_backup_retention",
  "get_backup_status",
  "list_bases",
  "get_base",
  "list_base_tables",
  "get_table",
  "list_table_fields",
  "get_field",
  "list_schema_changes",
  "list_schema_versions",
  "search_schema",
  "list_documents",
  "get_document",
  "create_document",
  "update_document",
  "delete_document",
  "list_entity_documents",
  "tag_document",
  "untag_document",
  "list_views",
  "get_view",
  "create_view",
  "update_view",
  "delete_view",
  "search_records",
  "search_documents",
  "search_reports",
  "search_attachments",
  "get_api_usage",
].sort();

describe("catalog ⇄ registry contract", () => {
  test("tool names are unique and match the stability snapshot", () => {
    const names = MCP_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(EXPECTED_TOOLS);
    expect(new Set(names).size).toBe(names.length);
  });

  test("every tool resolves to a real registry operation", () => {
    for (const tool of MCP_TOOLS) {
      const op = opForTool(operations, tool);
      expect(op, `${tool.name} → ${tool.method} ${tool.path} has no registry operation`).toBeDefined();
    }
  });

  test("every registry operation has an explicit MCP decision (tool or documented exclusion)", () => {
    // The only operation deliberately not exposed as a tool: the GET ?q=
    // search convenience — it duplicates search_schema for curl users.
    const EXCLUDED = new Set(["GET /v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/search"]);
    for (const op of operations) {
      const key = `${op.method} ${op.path}`;
      const hasTool = MCP_TOOLS.some((t) => t.method === op.method && t.path === op.path);
      expect(
        hasTool || EXCLUDED.has(key),
        `${key} is neither an MCP tool nor a documented exclusion — decide and record it`,
      ).toBe(true);
    }
  });

  test("every non-injected path param is a required tool arg", () => {
    for (const tool of MCP_TOOLS) {
      for (const [, param] of tool.path.matchAll(/\{(\w+)\}/g)) {
        if (param === "orgId" || param === "platform" || param === "spaceId") continue;
        expect(tool.argProps, `${tool.name} missing path arg ${param}`).toHaveProperty(param!);
        expect(tool.required ?? [], `${tool.name} must require ${param}`).toContain(param);
      }
    }
  });

  test("annotations track the method: GET/search read-only, mutations not, deletes destructive", () => {
    for (const def of MCP_TOOLS) {
      const tool = buildToolCatalog(operations, orgWide).find((t) => t.name === def.name)!;
      const expectReadOnly = def.readOnly ?? def.method === "GET";
      expect(tool.annotations.readOnlyHint, def.name).toBe(expectReadOnly);
      if (def.method === "DELETE") expect(tool.annotations.destructiveHint, def.name).toBe(true);
    }
  });
});

describe("scope-filtered catalog (D4)", () => {
  test("a backups:read-only token sees backup tools but no org/schema tools", () => {
    const names = buildToolCatalog(operations, { ...orgWide, scopes: ["backups:read"] }).map((t) => t.name);
    expect(names).toContain("list_backup_runs");
    expect(names).not.toContain("get_org");
    expect(names).not.toContain("search_schema");
  });
});

describe("grant-aware parameter injection (D5)", () => {
  test("orgId and platform are never tool args", () => {
    for (const tool of buildToolCatalog(operations, orgWide)) {
      const props = tool.inputSchema.properties as Record<string, unknown>;
      expect(props).not.toHaveProperty("orgId");
      expect(props).not.toHaveProperty("platform");
    }
  });

  test("Space-bound token: get_backup_status needs no args at all", () => {
    const tool = buildToolCatalog(operations, spaceBound).find((t) => t.name === "get_backup_status")!;
    expect(Object.keys(tool.inputSchema.properties as Record<string, unknown>)).toHaveLength(0);
  });

  test("Org-wide token: spaceId is a required arg on Space-scoped tools", () => {
    const tool = buildToolCatalog(operations, orgWide).find((t) => t.name === "get_backup_status")!;
    expect(tool.inputSchema.properties as Record<string, unknown>).toHaveProperty("spaceId");
    expect(tool.inputSchema.required as string[]).toContain("spaceId");
  });

  test("org-level tools never take spaceId", () => {
    for (const name of ["get_org", "list_spaces"]) {
      const tool = buildToolCatalog(operations, orgWide).find((t) => t.name === name)!;
      expect(tool.inputSchema.properties as Record<string, unknown>).not.toHaveProperty("spaceId");
    }
  });
});
