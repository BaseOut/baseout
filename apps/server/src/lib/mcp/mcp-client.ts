// Airtable MCP client — one-shot tool calls over the MCP Streamable HTTP
// transport (server-mcp-workspaces).
//
// COPY of the canonical client core in
// apps/workflows/trigger/tasks/_lib/mcp-client.ts (callMcpTool + SSE parsing +
// failure taxonomy) — parallel-until-third-consumer per house convention; the
// noted follow-up is extracting a `packages/mcp-client` workspace package now
// that two apps carry the code. Behavior MUST NOT diverge from the canonical
// source; transport facts are pinned by the 2026-07-14/2026-07-24/2026-07-27
// spikes (see the mcp change READMEs):
//   - ANY response may arrive as `text/event-stream` — SSE parsing is the
//     primary path;
//   - `Mcp-Session-Id` may not be issued; echo only when present;
//   - tool results carry BOTH `structuredContent` and `content[0].text`;
//   - a tool-level scope denial surfaces as a transport HTTP 403 → `auth`
//     (exactly how `list_workspaces` fails on the current grant).
//
// Never throws — every failure maps to `{ ok: false, reason }`.

const DEFAULT_ENDPOINT = "https://mcp.airtable.com/mcp";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_PAYLOAD_CHARS = 2 * 1024 * 1024;
const INITIAL_PROTOCOL_VERSION = "2025-06-18";

export type McpSkipReason =
  | "timeout"
  | "auth"
  | "transport"
  | "invalid_envelope"
  | "payload_too_large"
  | "rpc_error"
  | "no_result"
  | `http_${number}`;

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string;
  method?: string;
  result?: Record<string, unknown>;
  error?: unknown;
}

class PayloadTooLargeError extends Error {}
class HttpStatusError extends Error {
  constructor(public readonly status: number) {
    super(`mcp http ${status}`);
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function parseSseMessages(text: string): JsonRpcMessage[] {
  const messages: JsonRpcMessage[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const frame = line.slice(5).trim();
    if (!frame) continue;
    try {
      messages.push(JSON.parse(frame) as JsonRpcMessage);
    } catch {
      // Non-JSON frame (keep-alive etc.) — ignore.
    }
  }
  return messages;
}

export interface CallMcpToolArgs {
  tool: string;
  toolArgs: Record<string, unknown>;
  accessToken: string;
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export type CallMcpToolResult =
  | { ok: true; raw: unknown }
  | { ok: false; reason: McpSkipReason };

/** One-shot MCP exchange: initialize → notifications/initialized → tools/call. Never throws. */
export async function callMcpTool(args: CallMcpToolArgs): Promise<CallMcpToolResult> {
  const endpoint = args.endpoint ?? DEFAULT_ENDPOINT;
  const fetchFn = args.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let sessionId: string | null = null;
  let protocolVersion: string | null = null;
  let nextId = 0;

  async function post(
    payload: Record<string, unknown>,
    expectId: number | null,
  ): Promise<JsonRpcMessage | null> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${args.accessToken}`,
    };
    if (protocolVersion) headers["mcp-protocol-version"] = protocolVersion;
    if (sessionId) headers["mcp-session-id"] = sessionId;

    const res = await fetchFn(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const issuedSession = res.headers.get("mcp-session-id");
    if (issuedSession) sessionId = issuedSession;

    if (res.status < 200 || res.status >= 300) {
      await res.text().catch(() => {});
      throw new HttpStatusError(res.status);
    }

    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > MAX_PAYLOAD_CHARS) throw new PayloadTooLargeError();
    const text = await res.text();
    if (text.length > MAX_PAYLOAD_CHARS) throw new PayloadTooLargeError();
    if (expectId === null) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      const messages = parseSseMessages(text);
      return messages.find((m) => m.id === expectId) ?? null;
    }
    try {
      const message = JSON.parse(text) as JsonRpcMessage;
      return message.id === expectId ? message : null;
    } catch {
      return null;
    }
  }

  try {
    const initId = ++nextId;
    const init = await post(
      {
        jsonrpc: "2.0",
        id: initId,
        method: "initialize",
        params: {
          protocolVersion: INITIAL_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "baseout-engine", version: "1.0.0" },
        },
      },
      initId,
    );
    if (!init) return { ok: false, reason: "no_result" };
    if (init.error) return { ok: false, reason: "rpc_error" };
    const negotiated = init.result?.protocolVersion;
    protocolVersion = typeof negotiated === "string" ? negotiated : INITIAL_PROTOCOL_VERSION;

    await post({ jsonrpc: "2.0", method: "notifications/initialized" }, null);

    const callId = ++nextId;
    const call = await post(
      {
        jsonrpc: "2.0",
        id: callId,
        method: "tools/call",
        params: { name: args.tool, arguments: args.toolArgs },
      },
      callId,
    );
    if (!call) return { ok: false, reason: "no_result" };
    if (call.error) return { ok: false, reason: "rpc_error" };
    const result = call.result;
    if (!isRecord(result) || result.isError === true) {
      return { ok: false, reason: "rpc_error" };
    }

    let rawEnvelope: unknown = result.structuredContent;
    if (rawEnvelope === undefined && Array.isArray(result.content)) {
      const first = result.content[0];
      if (isRecord(first) && typeof first.text === "string") {
        try {
          rawEnvelope = JSON.parse(first.text);
        } catch {
          return { ok: false, reason: "invalid_envelope" };
        }
      }
    }
    if (rawEnvelope === undefined) return { ok: false, reason: "no_result" };
    return { ok: true, raw: rawEnvelope };
  } catch (err) {
    if (err instanceof PayloadTooLargeError) return { ok: false, reason: "payload_too_large" };
    if (err instanceof HttpStatusError) {
      if (err.status === 401 || err.status === 403) return { ok: false, reason: "auth" };
      return { ok: false, reason: `http_${err.status}` };
    }
    if (err instanceof Error && err.name === "AbortError") return { ok: false, reason: "timeout" };
    return { ok: false, reason: "transport" };
  } finally {
    clearTimeout(timer);
  }
}

// ───────────────────────── workspace listing ─────────────────────────

export interface McpWorkspace {
  id: string;
  name: string | null;
  permissionLevel: string | null;
  /**
   * Base membership IF the envelope carries it (design Decision 5 tolerates
   * either shape; unverified until the scope lands — the 2026-07-27 spike
   * found NO membership path on the current grant: `list_bases` has no
   * workspace field either). Absent → auto-enroll's base diff is a no-op.
   */
  bases?: { id: string; name: string }[];
}

export type FetchWorkspacesResult =
  | { ok: true; workspaces: McpWorkspace[]; capturedAt: string }
  | { ok: false; reason: McpSkipReason };

/**
 * `tools/call list_workspaces {}` — "Lists all workspaces the current user has
 * access to, along with their permission level in each."
 *
 * ⚠ ENVELOPE UNVERIFIED (spike 2026-07-27, ../../openspec/changes/
 * server-mcp-workspaces/README.md): the call 403s on the current OAuth grant
 * (`workspacesAndBases:read` missing — Features §17 Q20), so validation below
 * is deliberately tolerant (`workspaces[]` with string ids) and MUST be
 * re-pinned against a real envelope once a scope-bearing token exists.
 * Pagination (`offset`) is advertised; a follow-up loop lands with the
 * re-pin. Until the scope decision, every production call resolves
 * `{ ok:false, reason:'auth' }` — the callers' documented degraded state.
 */
export async function fetchWorkspaces(args: {
  accessToken: string;
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<FetchWorkspacesResult> {
  const result = await callMcpTool({ tool: "list_workspaces", toolArgs: {}, ...args });
  if (!result.ok) return result;
  const raw = result.raw;
  if (!isRecord(raw) || !Array.isArray(raw.workspaces)) {
    return { ok: false, reason: "invalid_envelope" };
  }
  const workspaces: McpWorkspace[] = [];
  for (const w of raw.workspaces) {
    if (!isRecord(w) || typeof w.id !== "string") continue;
    const entry: McpWorkspace = {
      id: w.id,
      name: typeof w.name === "string" ? w.name : null,
      permissionLevel: typeof w.permissionLevel === "string" ? w.permissionLevel : null,
    };
    if (Array.isArray(w.bases)) {
      entry.bases = w.bases
        .filter((b): b is Record<string, unknown> => isRecord(b))
        .filter((b) => typeof b.id === "string" && typeof b.name === "string")
        .map((b) => ({ id: b.id as string, name: b.name as string }));
    }
    workspaces.push(entry);
  }
  return { ok: true, workspaces, capturedAt: new Date().toISOString() };
}
