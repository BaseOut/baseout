// Airtable MCP client — tool calls over the MCP Streamable HTTP transport
// (workflows-mcp-interface-pages; generalized for workflows-mcp-automations,
// then for workflows-mcp-views' one-session-many-calls shape).
//
// Hand-rolled JSON-RPC 2.0 instead of the MCP SDK: the exchange is three POSTs
// (initialize → notifications/initialized → tools/call), we control the
// timeout with a single AbortController, and tests inject fetchImpl (house
// convention). `runMcpSession` owns the transport (one handshake, N sequential
// tools/call — the 2026-07-27 views spike confirmed 11 calls on one handshake);
// `callMcpTool` is the single-call form. The exported per-tool wrappers
// (`fetchInterfacePages`, `fetchAutomations`, `fetchViews`) own envelope
// validation, and the first two MUST NOT diverge in behavior from the
// pre-refactor client — the interface-pages test matrix pins this.
//
// Transport facts pinned by the 2026-07-14 spike (workflows-mcp-interface-pages
// README) and re-confirmed 2026-07-24 (automations) + 2026-07-27 (views):
//   - ANY response may arrive as `text/event-stream` — even a single message
//     — so SSE parsing is the primary path: read the stream to completion,
//     discard notification frames, resolve on the message whose `id` matches.
//   - `Mcp-Session-Id` may not be issued; echo it only when present.
//   - Tool results carry BOTH `structuredContent` (parsed) and
//     `content[0].text` (same JSON as a string) — prefer the former.
//
// Failure isolation contract (all three change specs): these functions NEVER
// throw — every failure mode maps to `{ ok: false, reason }` so the backup
// run's outcome is untouched. Envelope validation is deliberately shallow; the
// engine owns entity extraction and deep tolerance
// (apps/server/src/lib/per-space/{interfaces,automations,views}-sync.ts).

import type { McpSkipReason } from "./mcp-capture-common";

const DEFAULT_ENDPOINT = "https://mcp.airtable.com/mcp";
const DEFAULT_TIMEOUT_MS = 30_000;
/** Envelope cap before forwarding to the engine — observed sizes are KBs. */
const MAX_PAYLOAD_CHARS = 2 * 1024 * 1024;
const INITIAL_PROTOCOL_VERSION = "2025-06-18";

// fetchViews fans out one tools/call per table on a single session (spike:
// ~180 bytes and sub-second per call), so its default timeout scales with the
// table count instead of the flat single-call default — capped so a
// pathological base can't stall the schema-sync POST for minutes.
const VIEWS_PER_TABLE_TIMEOUT_MS = 2_000;
const VIEWS_MAX_TIMEOUT_MS = 120_000;

// Re-export for back-compat: the skip-reason union moved to
// mcp-capture-common.ts (workflows-mcp-views task 1.2); existing imports from
// this module keep working.
export type { McpSkipReason } from "./mcp-capture-common";

/** Back-compat alias — the interface-pages change exported this name. */
export type InterfacePagesSkipReason = McpSkipReason;

export interface InterfacePagesEnvelope extends Record<string, unknown> {
  interfaces: unknown[];
  standaloneForms: unknown[];
}

export type FetchInterfacePagesResult =
  | { ok: true; raw: InterfacePagesEnvelope; capturedAt: string }
  | { ok: false; reason: McpSkipReason };

export interface AutomationsEnvelope extends Record<string, unknown> {
  automations: unknown[];
}

export type FetchAutomationsResult =
  | { ok: true; raw: AutomationsEnvelope; capturedAt: string }
  | { ok: false; reason: McpSkipReason };

/**
 * Wire shape of the optional `views` field on the schema-sync POST body.
 * MIRROR of the canonical `ViewsCapture` in
 * apps/server/src/lib/per-space/views-sync.ts (server-mcp-views owns it) —
 * do not import across apps. Each entry's `raw` is one table's
 * `list_views_for_table` envelope, forwarded verbatim.
 */
export interface ViewsCapture {
  /** ISO-8601 — when the MCP capture resolved on the workflows side. */
  capturedAt: string;
  tables: { tableId: string; raw: unknown }[];
}

export type FetchViewsResult =
  | { ok: true; capture: ViewsCapture }
  | { ok: false; reason: McpSkipReason };

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
/** Internal control-flow error carrying an already-mapped skip reason. */
class McpFailure extends Error {
  constructor(public readonly reason: McpSkipReason) {
    super(`mcp ${reason}`);
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Parse an SSE body: collect `data:` frames as JSON-RPC messages. */
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
  /** Override for tests / failure drills; production uses the constant. */
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export type CallMcpToolResult =
  | { ok: true; raw: unknown }
  | { ok: false; reason: McpSkipReason };

interface McpSessionArgs {
  accessToken: string;
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * One MCP session: initialize → notifications/initialized → then `body` runs
 * with a `callTool` that issues sequential tools/call requests on the SAME
 * handshake (one-handshake-many-calls confirmed by the 2026-07-27 views
 * spike). A single AbortController timeout covers the whole session.
 * `callTool` resolves to the tool result's raw envelope (structuredContent,
 * falling back to parsing content[0].text) WITHOUT shape validation — each
 * tool wrapper owns its envelope. This function never throws; every failure
 * maps to `{ ok: false, reason }`.
 */
async function runMcpSession<T>(
  args: McpSessionArgs,
  body: (
    callTool: (tool: string, toolArgs: Record<string, unknown>) => Promise<unknown>,
  ) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; reason: McpSkipReason }> {
  const endpoint = args.endpoint ?? DEFAULT_ENDPOINT;
  const fetchFn = args.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let sessionId: string | null = null;
  let protocolVersion: string | null = null;
  let nextId = 0;

  // POST one JSON-RPC payload and (for requests) resolve the response message
  // whose id matches — reading either a plain-JSON or an SSE body to
  // completion within the shared abort window.
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

  async function callTool(
    tool: string,
    toolArgs: Record<string, unknown>,
  ): Promise<unknown> {
    const callId = ++nextId;
    const call = await post(
      {
        jsonrpc: "2.0",
        id: callId,
        method: "tools/call",
        params: { name: tool, arguments: toolArgs },
      },
      callId,
    );
    if (!call) throw new McpFailure("no_result");
    if (call.error) throw new McpFailure("rpc_error");
    const result = call.result;
    if (!isRecord(result) || result.isError === true) {
      throw new McpFailure("rpc_error");
    }

    let rawEnvelope: unknown = result.structuredContent;
    if (rawEnvelope === undefined && Array.isArray(result.content)) {
      const textPart = result.content.find(
        (c): c is { type: string; text: string } => isRecord(c) && c.type === "text" && typeof c.text === "string",
      );
      if (textPart) {
        try {
          rawEnvelope = JSON.parse(textPart.text);
        } catch {
          rawEnvelope = undefined;
        }
      }
    }
    if (rawEnvelope === undefined) throw new McpFailure("invalid_envelope");
    return rawEnvelope;
  }

  try {
    // 1. initialize — negotiate protocol version, capture optional session id.
    const initId = ++nextId;
    const init = await post(
      {
        jsonrpc: "2.0",
        id: initId,
        method: "initialize",
        params: {
          protocolVersion: INITIAL_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "baseout-backup", version: "1.0.0" },
        },
      },
      initId,
    );
    if (!init) return { ok: false, reason: "no_result" };
    if (init.error) return { ok: false, reason: "rpc_error" };
    const negotiated = init.result?.protocolVersion;
    protocolVersion = typeof negotiated === "string" ? negotiated : INITIAL_PROTOCOL_VERSION;

    // 2. notifications/initialized — no id, no response body expected (202).
    await post({ jsonrpc: "2.0", method: "notifications/initialized" }, null);

    // 3. tools/call(s) — the caller drives.
    const value = await body(callTool);
    return { ok: true, value };
  } catch (err) {
    if (err instanceof McpFailure) return { ok: false, reason: err.reason };
    if (err instanceof PayloadTooLargeError) return { ok: false, reason: "payload_too_large" };
    if (err instanceof HttpStatusError) {
      if (err.status === 401 || err.status === 403) return { ok: false, reason: "auth" };
      return { ok: false, reason: `http_${err.status}` };
    }
    if (controller.signal.aborted) return { ok: false, reason: "timeout" };
    return { ok: false, reason: "transport" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One-shot MCP exchange: initialize → notifications/initialized → tools/call.
 * Returns the tool result's raw envelope WITHOUT shape validation — each tool
 * wrapper owns its envelope. Never throws.
 */
export async function callMcpTool(args: CallMcpToolArgs): Promise<CallMcpToolResult> {
  const session = await runMcpSession(args, (callTool) => callTool(args.tool, args.toolArgs));
  if (!session.ok) return session;
  return { ok: true, raw: session.value };
}

function validateInterfacePagesEnvelope(raw: unknown): InterfacePagesEnvelope | null {
  if (!isRecord(raw) || !Array.isArray(raw.interfaces) || !Array.isArray(raw.standaloneForms)) {
    return null;
  }
  return raw as InterfacePagesEnvelope;
}

export async function fetchInterfacePages(args: {
  baseId: string;
  accessToken: string;
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<FetchInterfacePagesResult> {
  const result = await callMcpTool({
    tool: "list_pages_for_base",
    toolArgs: { baseId: args.baseId },
    accessToken: args.accessToken,
    endpoint: args.endpoint,
    timeoutMs: args.timeoutMs,
    fetchImpl: args.fetchImpl,
  });
  if (!result.ok) return result;
  const envelope = validateInterfacePagesEnvelope(result.raw);
  if (!envelope) return { ok: false, reason: "invalid_envelope" };
  return { ok: true, raw: envelope, capturedAt: new Date().toISOString() };
}

function validateAutomationsEnvelope(raw: unknown): AutomationsEnvelope | null {
  if (!isRecord(raw) || !Array.isArray(raw.automations)) return null;
  return raw as AutomationsEnvelope;
}

/**
 * Fetch a base's automations via the MCP `list_automations` tool
 * (workflows-mcp-automations, spike 2026-07-24). Top-level envelope shape:
 * `{ automations: [] }`; per-entry shape is engine-side territory.
 */
export async function fetchAutomations(args: {
  baseId: string;
  accessToken: string;
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<FetchAutomationsResult> {
  const result = await callMcpTool({
    tool: "list_automations",
    toolArgs: { baseId: args.baseId },
    accessToken: args.accessToken,
    endpoint: args.endpoint,
    timeoutMs: args.timeoutMs,
    fetchImpl: args.fetchImpl,
  });
  if (!result.ok) return result;
  const envelope = validateAutomationsEnvelope(result.raw);
  if (!envelope) return { ok: false, reason: "invalid_envelope" };
  return { ok: true, raw: envelope, capturedAt: new Date().toISOString() };
}

/**
 * Fetch a base's views via the MCP `list_views_for_table` tool
 * (workflows-mcp-views, spike 2026-07-27). The tool is PER-TABLE — there is
 * no per-base view tool — so this fans out one tools/call per table on a
 * SINGLE handshake, validating each envelope's top level (`views` array).
 *
 * ALL-OR-SKIP: the aggregated capture is returned only when EVERY table's
 * call succeeded — any per-table failure skips the whole capture, because a
 * partial capture would read server-side as "the missing tables' views were
 * deleted" (the sweep rule treats a successful capture as a full sighting).
 *
 * An empty tableIds list resolves ok with zero network calls.
 */
export async function fetchViews(args: {
  baseId: string;
  tableIds: string[];
  accessToken: string;
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<FetchViewsResult> {
  if (args.tableIds.length === 0) {
    return { ok: true, capture: { capturedAt: new Date().toISOString(), tables: [] } };
  }
  const timeoutMs =
    args.timeoutMs ??
    Math.min(
      DEFAULT_TIMEOUT_MS + VIEWS_PER_TABLE_TIMEOUT_MS * args.tableIds.length,
      VIEWS_MAX_TIMEOUT_MS,
    );
  const session = await runMcpSession(
    {
      accessToken: args.accessToken,
      endpoint: args.endpoint,
      timeoutMs,
      fetchImpl: args.fetchImpl,
    },
    async (callTool) => {
      const tables: { tableId: string; raw: unknown }[] = [];
      for (const tableId of args.tableIds) {
        const raw = await callTool("list_views_for_table", {
          baseId: args.baseId,
          tableId,
        });
        if (!isRecord(raw) || !Array.isArray(raw.views)) {
          throw new McpFailure("invalid_envelope");
        }
        tables.push({ tableId, raw });
      }
      return tables;
    },
  );
  if (!session.ok) return session;
  return {
    ok: true,
    capture: { capturedAt: new Date().toISOString(), tables: session.value },
  };
}
