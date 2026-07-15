// Airtable MCP client — one-shot `list_pages_for_base` tool call
// (workflows-mcp-interface-pages, design Decision 1).
//
// Hand-rolled JSON-RPC 2.0 over the MCP Streamable HTTP transport instead of
// the MCP SDK: the exchange is three POSTs (initialize →
// notifications/initialized → tools/call), we control the timeout with a
// single AbortController, and tests inject fetchImpl (house convention).
//
// Transport facts pinned by the 2026-07-14 spike (change README):
//   - ANY response may arrive as `text/event-stream` — even a single message
//     — so SSE parsing is the primary path: read the stream to completion,
//     discard notification frames, resolve on the message whose `id` matches.
//   - `Mcp-Session-Id` may not be issued; echo it only when present.
//   - Tool results carry BOTH `structuredContent` (parsed) and
//     `content[0].text` (same JSON as a string) — prefer the former.
//
// Failure isolation contract (change spec): this function NEVER throws — every
// failure mode maps to `{ ok: false, reason }` so the backup run's outcome is
// untouched. Envelope validation is deliberately shallow (`interfaces[]` /
// `standaloneForms[]` exist); the engine owns entity extraction and deep
// tolerance (apps/server/src/lib/per-space/interfaces-sync.ts).

const DEFAULT_ENDPOINT = "https://mcp.airtable.com/mcp";
const DEFAULT_TIMEOUT_MS = 30_000;
/** Envelope cap before forwarding to the engine — observed sizes are KBs. */
const MAX_PAYLOAD_CHARS = 2 * 1024 * 1024;
const TOOL_NAME = "list_pages_for_base";
const INITIAL_PROTOCOL_VERSION = "2025-06-18";

export type InterfacePagesSkipReason =
  | "timeout"
  | "auth"
  | "transport"
  | "invalid_envelope"
  | "payload_too_large"
  | "rpc_error"
  | "no_result"
  | `http_${number}`;

export interface InterfacePagesEnvelope extends Record<string, unknown> {
  interfaces: unknown[];
  standaloneForms: unknown[];
}

export type FetchInterfacePagesResult =
  | { ok: true; raw: InterfacePagesEnvelope; capturedAt: string }
  | { ok: false; reason: InterfacePagesSkipReason };

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

function validateEnvelope(raw: unknown): InterfacePagesEnvelope | null {
  if (!isRecord(raw) || !Array.isArray(raw.interfaces) || !Array.isArray(raw.standaloneForms)) {
    return null;
  }
  return raw as InterfacePagesEnvelope;
}

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

export async function fetchInterfacePages(args: {
  baseId: string;
  accessToken: string;
  /** Override for tests / failure drills; production uses the constant. */
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<FetchInterfacePagesResult> {
  const endpoint = args.endpoint ?? DEFAULT_ENDPOINT;
  const fetchFn = args.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let sessionId: string | null = null;
  let protocolVersion: string | null = null;
  let nextId = 0;

  // POST one JSON-RPC payload and (for requests) resolve the response message
  // whose id matches — reading either a plain-JSON or an SSE body to
  // completion within the shared abort window (task 2.1b).
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

    // 3. tools/call list_pages_for_base.
    const callId = ++nextId;
    const call = await post(
      {
        jsonrpc: "2.0",
        id: callId,
        method: "tools/call",
        params: { name: TOOL_NAME, arguments: { baseId: args.baseId } },
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

    const envelope = validateEnvelope(rawEnvelope);
    if (!envelope) return { ok: false, reason: "invalid_envelope" };
    return { ok: true, raw: envelope, capturedAt: new Date().toISOString() };
  } catch (err) {
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
