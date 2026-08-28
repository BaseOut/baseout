// MCP tool dispatch (api-mcp §2.3, write conventions in api-write-foundation).
// Executes a tool by calling its backing REST operation handler IN-PROCESS (no
// self-HTTP) under the same token grant, scope checks, tenant-safe 404s, and
// metering (surface="mcp"). Path params are DERIVED from the operation's path
// template (no hardcoded list): orgId + {platform} are injected; spaceId is
// injected for Space-bound tokens; the remaining template params come from the
// tool args. A tool's bodyArgs declaration splits the rest between the JSON
// body (validated by the operation's bodySchema — same rigor as REST) and the
// query string. A non-2xx REST response maps to an MCP tool error
// (isError: true) so the agent sees it — parity with the REST codes.

import type { Sql } from "postgres";
import type { ApiDb } from "../db/client";
import type { Env } from "../env";
import type { TokenGrant } from "../lib/auth";
import { validateBodyValue } from "../lib/body";
import { DEFAULT_PLATFORM } from "../lib/platform";
import type { Operation, OperationContext } from "../lib/registry";
import { MCP_TOOLS } from "./tools";
import { enrichWithAppUrl } from "./app-urls";
import { opForTool, pathParamNames } from "./catalog";

export interface McpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface DispatchDeps {
  operations: Operation[];
  /** Tool catalog override (tests); defaults to the shipped MCP_TOOLS. */
  tools?: typeof MCP_TOOLS;
  db: ApiDb;
  sql: Sql;
  env: Env;
  ctx: ExecutionContext;
  grant: TokenGrant;
  now: Date;
  requestId: string;
}

const textResult = (text: string, isError = false): McpToolResult => ({ content: [{ type: "text", text }], isError });

export async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  deps: DispatchDeps,
): Promise<McpToolResult> {
  const tools = deps.tools ?? MCP_TOOLS;
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) return textResult(JSON.stringify({ error: { code: "unknown_tool", message: `No such tool: ${toolName}` } }), true);
  const op = opForTool(deps.operations, tool);
  if (!op) return textResult(JSON.stringify({ error: { code: "unknown_tool", message: `Tool ${toolName} has no operation` } }), true);

  // Path params — derived from the operation's path template: orgId + platform
  // injected; spaceId injected for Space-bound tokens, else from args; every
  // other template param from the same-named tool arg.
  const templateParams = pathParamNames(op.path);
  const params: Record<string, string> = { orgId: deps.grant.organizationId };
  for (const p of templateParams) {
    if (p === "orgId") continue;
    if (p === "platform") {
      params.platform = DEFAULT_PLATFORM;
    } else if (p === "spaceId") {
      const spaceId = deps.grant.spaceId ?? (typeof args.spaceId === "string" ? args.spaceId : undefined);
      if (!spaceId) return textResult(JSON.stringify({ error: { code: "invalid_request", param: "spaceId", message: "spaceId is required for an org-wide token." } }), true);
      params.spaceId = spaceId;
    } else if (typeof args[p] === "string") {
      params[p] = args[p] as string;
    }
  }

  // Split the remaining args between JSON body and query per the tool's
  // bodyArgs declaration.
  const isPathParam = (k: string) => templateParams.includes(k) || k === "spaceId";
  const query = new URLSearchParams();
  let body: unknown;
  const bodyEntries: Record<string, unknown> = {};
  let hasBody = false;
  for (const [k, v] of Object.entries(args)) {
    if (isPathParam(k)) continue;
    if (v == null) continue;
    const inBody = tool.bodyArgs === "all" || (Array.isArray(tool.bodyArgs) && tool.bodyArgs.includes(k));
    if (inBody) {
      bodyEntries[k] = v;
      hasBody = true;
    } else {
      query.set(k, String(v));
    }
  }
  if (tool.bodyArgs != null || hasBody) body = bodyEntries;

  try {
    // Same validation rigor as the REST router (design D1): the operation's
    // bodySchema gates the MCP-built body too.
    if (op.bodySchema && body !== undefined) body = validateBodyValue(op.bodySchema, body);

    const c: OperationContext = {
      db: deps.db, sql: deps.sql, env: deps.env, ctx: deps.ctx, grant: deps.grant,
      params, query, body, requestId: deps.requestId, headers: new Headers(), now: deps.now,
    };
    const res = await op.handler(c);
    const text = await res.text();
    const isError = res.status < 200 || res.status >= 300;
    // appUrl deep links (api-search-tools D4): parse the 2xx result once,
    // enrich per tool, re-stringify. No-op when PUBLIC_APP_URL is unset.
    if (!isError && deps.env.PUBLIC_APP_URL && text) {
      try {
        const enriched = enrichWithAppUrl(toolName, args, JSON.parse(text), deps.env.PUBLIC_APP_URL);
        return textResult(JSON.stringify(enriched), false);
      } catch { /* non-JSON body — return it untouched */ }
    }
    return textResult(text || "{}", isError);
  } catch (err) {
    // ApiError thrown by validation/guards/handlers → surface its wire body as a tool error.
    const e = err as { type?: string; code?: string; message?: string; param?: string };
    if (e && typeof e.code === "string") {
      return textResult(JSON.stringify({ error: { type: e.type, code: e.code, message: e.message, ...(e.param ? { param: e.param } : {}) } }), true);
    }
    return textResult(JSON.stringify({ error: { code: "internal", message: "Tool execution failed." } }), true);
  }
}
