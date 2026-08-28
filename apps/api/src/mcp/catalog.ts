// MCP tool catalog builder (api-mcp §1.2, write conventions in
// api-write-foundation). Produces the `tools/list` payload for a given token
// grant: scope-filtered (a tool whose operation's scope the token lacks is
// omitted) and grant-aware (spaceId is a required arg only when the token is
// org-wide; a Space-bound token injects it, so it's elided). orgId and
// {platform} are always injected and never appear as args. Annotations are
// method-derived — GET → readOnlyHint true, mutations false, DELETE adds
// destructiveHint — with a per-tool readOnly override for POST reads (search).

import type { Operation } from "../lib/registry";
import type { TokenGrant } from "../lib/auth";
import { MCP_TOOLS, type McpToolDef } from "./tools";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; destructiveHint?: boolean };
}

/** `{param}` names of a path template, in order. */
export function pathParamNames(path: string): string[] {
  return [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
}

const pathHas = (path: string, param: string) => path.includes(`{${param}}`);

/** Resolve a tool def to its backing REST operation (by method + path). */
export function opForTool(operations: Operation[], tool: McpToolDef): Operation | undefined {
  return operations.find((o) => o.method === tool.method && o.path === tool.path);
}

export function toolInputSchema(tool: McpToolDef, grant: TokenGrant): Record<string, unknown> {
  const properties: Record<string, unknown> = { ...tool.argProps };
  const required = [...(tool.required ?? [])];
  // Org-wide token → spaceId is a required arg; Space-bound token injects it.
  if (pathHas(tool.path, "spaceId") && grant.spaceId == null) {
    properties.spaceId = { type: "string" };
    required.push("spaceId");
  }
  return { type: "object", properties, required, additionalProperties: false };
}

export function toolAnnotations(tool: McpToolDef): McpTool["annotations"] {
  const readOnlyHint = tool.readOnly ?? tool.method === "GET";
  return tool.method === "DELETE" ? { readOnlyHint, destructiveHint: true } : { readOnlyHint };
}

export function buildToolCatalog(operations: Operation[], grant: TokenGrant, tools: McpToolDef[] = MCP_TOOLS): McpTool[] {
  const catalog: McpTool[] = [];
  for (const tool of tools) {
    const op = opForTool(operations, tool);
    if (!op) continue; // contract test guarantees this can't happen at runtime
    if (!grant.scopes.includes(op.scope)) continue;
    catalog.push({
      name: tool.name,
      description: tool.description,
      inputSchema: toolInputSchema(tool, grant),
      annotations: toolAnnotations(tool),
    });
  }
  return catalog;
}
