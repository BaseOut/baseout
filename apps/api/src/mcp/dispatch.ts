// MCP tool dispatch (api-mcp §2.3). Executes a tool by calling its backing REST
// operation handler IN-PROCESS (no self-HTTP) under the same token grant, scope
// checks, tenant-safe 404s, and metering (surface="mcp"). orgId/{platform} are
// injected; spaceId is injected for Space-bound tokens; other path params + query
// come from the tool args; the search tool's args become the request body. A
// non-2xx REST response maps to an MCP tool error (isError: true) so the agent
// sees it — parity with the REST codes.

import type { Sql } from "postgres";
import type { ApiDb } from "../db/client";
import type { Env } from "../env";
import type { TokenGrant } from "../lib/auth";
import type { Operation, OperationContext } from "../lib/registry";
import { MCP_TOOLS } from "./tools";
import { opForTool } from "./catalog";

export interface McpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface DispatchDeps {
  operations: Operation[];
  db: ApiDb;
  sql: Sql;
  env: Env;
  ctx: ExecutionContext;
  grant: TokenGrant;
  now: Date;
  requestId: string;
}

const PATH_PARAMS = ["orgId", "spaceId", "platform", "runId", "baseId", "tableId", "fieldId"];
const pathHas = (path: string, param: string) => path.includes(`{${param}}`);

const textResult = (text: string, isError = false): McpToolResult => ({ content: [{ type: "text", text }], isError });

export async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  deps: DispatchDeps,
): Promise<McpToolResult> {
  const tool = MCP_TOOLS.find((t) => t.name === toolName);
  if (!tool) return textResult(JSON.stringify({ error: { code: "unknown_tool", message: `No such tool: ${toolName}` } }), true);
  const op = opForTool(deps.operations, tool);
  if (!op) return textResult(JSON.stringify({ error: { code: "unknown_tool", message: `Tool ${toolName} has no operation` } }), true);

  // Build path params: orgId + platform injected; spaceId injected for
  // Space-bound tokens, else from args; remaining path params from args.
  const params: Record<string, string> = { orgId: deps.grant.organizationId };
  if (pathHas(op.path, "platform")) params.platform = "at";
  if (pathHas(op.path, "spaceId")) {
    const spaceId = deps.grant.spaceId ?? (typeof args.spaceId === "string" ? args.spaceId : undefined);
    if (!spaceId) return textResult(JSON.stringify({ error: { code: "invalid_request", param: "spaceId", message: "spaceId is required for an org-wide token." } }), true);
    params.spaceId = spaceId;
  }
  for (const p of PATH_PARAMS) {
    if (p === "orgId" || p === "spaceId" || p === "platform") continue;
    if (pathHas(op.path, p) && typeof args[p] === "string") params[p] = args[p] as string;
  }

  // Query (GET) or body (search): remaining args that aren't path params.
  const query = new URLSearchParams();
  let body: unknown;
  if (tool.bodyTool) {
    const { spaceId: _s, ...rest } = args;
    body = rest;
  } else {
    for (const [k, v] of Object.entries(args)) {
      if (PATH_PARAMS.includes(k)) continue;
      if (v == null) continue;
      query.set(k, String(v));
    }
  }

  const c: OperationContext = {
    db: deps.db, sql: deps.sql, env: deps.env, ctx: deps.ctx, grant: deps.grant,
    params, query, body, requestId: deps.requestId, headers: new Headers(), now: deps.now,
  };

  try {
    const res = await op.handler(c);
    const text = await res.text();
    return textResult(text || "{}", res.status < 200 || res.status >= 300);
  } catch (err) {
    // ApiError thrown by guards/handlers → surface its wire body as a tool error.
    const e = err as { type?: string; code?: string; message?: string; param?: string };
    if (e && typeof e.code === "string") {
      return textResult(JSON.stringify({ error: { type: e.type, code: e.code, message: e.message, ...(e.param ? { param: e.param } : {}) } }), true);
    }
    return textResult(JSON.stringify({ error: { code: "internal", message: "Tool execution failed." } }), true);
  }
}
