// Streamable HTTP MCP transport (api-mcp §2.1) — stateless JSON-RPC 2.0 over POST,
// Workers-native (no SDK dependency that might not run in workerd). Implements
// initialize, tools/list (scope-filtered per token), tools/call (in-process
// dispatch), ping, and the initialized notification. Auth is enforced by the
// caller (index.ts) before this runs (§2.2).

import { buildToolCatalog } from "./catalog";
import { callTool, type DispatchDeps } from "./dispatch";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "baseout", version: "1.0.0" };

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: { name?: unknown; arguments?: unknown } & Record<string, unknown>;
}

const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const err = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
const isNotification = (m: JsonRpcMessage) => m.id === undefined || m.id === null;

async function handleMessage(m: JsonRpcMessage, deps: DispatchDeps): Promise<object | null> {
  switch (m.method) {
    case "initialize":
      return ok(m.id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO });
    case "notifications/initialized":
      return null;
    case "ping":
      return ok(m.id, {});
    case "tools/list":
      return ok(m.id, { tools: buildToolCatalog(deps.operations, deps.grant) });
    case "tools/call": {
      const name = m.params?.name;
      if (typeof name !== "string") return err(m.id, -32602, "Invalid params: 'name' is required");
      const args = (m.params?.arguments && typeof m.params.arguments === "object" ? m.params.arguments : {}) as Record<string, unknown>;
      return ok(m.id, await callTool(name, args, deps));
    }
    default:
      if (isNotification(m)) return null;
      return err(m.id, -32601, `Method not found: ${m.method}`);
  }
}

/** Label the request for metering (§2.4: tool name as route template). */
function labelOf(payload: JsonRpcMessage | JsonRpcMessage[]): string {
  if (Array.isArray(payload)) return "mcp:batch";
  if (payload.method === "tools/call" && typeof payload.params?.name === "string") return `mcp:tools/call:${payload.params.name}`;
  return `mcp:${payload.method ?? "unknown"}`;
}

export async function handleMcp(
  request: Request,
  deps: DispatchDeps,
  requestId: string,
): Promise<{ res: Response; label: string }> {
  if (request.method !== "POST") {
    return { res: new Response(JSON.stringify(err(null, -32600, "MCP endpoint accepts POST")), { status: 405, headers: { "content-type": "application/json", "x-request-id": requestId } }), label: "mcp:invalid" };
  }
  let payload: JsonRpcMessage | JsonRpcMessage[] | null;
  try {
    payload = (await request.json()) as JsonRpcMessage | JsonRpcMessage[];
  } catch {
    return { res: new Response(JSON.stringify(err(null, -32700, "Parse error")), { status: 400, headers: { "content-type": "application/json", "x-request-id": requestId } }), label: "mcp:parse_error" };
  }

  const messages = Array.isArray(payload) ? payload : [payload];
  const responses: object[] = [];
  for (const m of messages) {
    const r = await handleMessage(m, deps);
    if (r) responses.push(r);
  }

  const label = labelOf(payload);
  if (!responses.length) {
    return { res: new Response(null, { status: 202, headers: { "x-request-id": requestId } }), label };
  }
  const out = Array.isArray(payload) ? responses : responses[0];
  return { res: new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json", "x-request-id": requestId } }), label };
}
