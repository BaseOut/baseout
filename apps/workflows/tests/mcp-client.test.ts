// Unit tests for the Airtable MCP client (workflows-mcp-interface-pages).
//
// The client performs a one-shot Streamable-HTTP JSON-RPC exchange against
// https://mcp.airtable.com/mcp: initialize → notifications/initialized →
// tools/call list_pages_for_base. Exercised via injected `fetchImpl` (house
// convention — no real network). Transport facts pinned from the 2026-07-14
// spike (openspec/changes/workflows-mcp-interface-pages/README.md):
//   - every response may arrive as SSE, even single messages,
//   - Mcp-Session-Id may NOT be issued (must stay optional),
//   - tool results carry BOTH structuredContent and content[0].text.

import { describe, expect, it } from "vitest";
import {
  fetchInterfacePages,
  type FetchInterfacePagesResult,
} from "../trigger/tasks/_lib/mcp-client";

const ENDPOINT = "https://mcp.example.test/mcp";
const BASE_ID = "appAAAA111122223333";
const TOKEN = "oaat_test_token";

const ENVELOPE = {
  interfaces: [{ id: "pbdX", name: "Interface", pages: [] }],
  standaloneForms: [],
};

function jsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

function sseResponse(frames: unknown[], headers: Record<string, string> = {}): Response {
  const body = frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream", ...headers },
  });
}

interface Captured {
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/**
 * Sequential fake transport: each call pops the next responder. Captures
 * request headers + parsed body for assertions.
 */
function fakeTransport(
  responders: ((req: Captured) => Response)[],
): { fetchImpl: typeof fetch; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) {
      headers[k.toLowerCase()] = v;
    }
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const captured = { headers, body };
    calls.push(captured);
    const responder = responders.shift();
    if (!responder) throw new Error("fake transport exhausted");
    return responder(captured);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const initResult = (over: Record<string, unknown> = {}) => (req: Captured) =>
  jsonResponse(
    {
      jsonrpc: "2.0",
      id: req.body.id,
      result: {
        protocolVersion: "2025-06-18",
        serverInfo: { name: "airtable-mcp-server", version: "0.0.1" },
      },
    },
    over as Record<string, string>,
  );

const emptyAck = () => () => new Response(null, { status: 202 });

const toolResult = (result: unknown) => (req: Captured) =>
  jsonResponse({ jsonrpc: "2.0", id: req.body.id, result });

function run(
  responders: ((req: Captured) => Response)[],
  opts: { timeoutMs?: number } = {},
): { promise: Promise<FetchInterfacePagesResult>; calls: Captured[] } {
  const { fetchImpl, calls } = fakeTransport(responders);
  return {
    promise: fetchInterfacePages({
      baseId: BASE_ID,
      accessToken: TOKEN,
      endpoint: ENDPOINT,
      timeoutMs: opts.timeoutMs ?? 5_000,
      fetchImpl,
    }),
    calls,
  };
}

describe("fetchInterfacePages — happy paths", () => {
  it("plain-JSON responses: full handshake, returns the envelope + capturedAt", async () => {
    const { promise, calls } = run([
      initResult(),
      emptyAck(),
      toolResult({ structuredContent: ENVELOPE, content: [], isError: false }),
    ]);
    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.raw).toEqual(ENVELOPE);
    expect(Date.parse(result.capturedAt)).not.toBeNaN();

    expect(calls).toHaveLength(3);
    expect(calls[0]!.body.method).toBe("initialize");
    expect(calls[1]!.body.method).toBe("notifications/initialized");
    expect(calls[2]!.body).toMatchObject({
      method: "tools/call",
      params: { name: "list_pages_for_base", arguments: { baseId: BASE_ID } },
    });
    for (const call of calls) {
      expect(call.headers.authorization).toBe(`Bearer ${TOKEN}`);
      expect(call.headers.accept).toBe("application/json, text/event-stream");
    }
    // Negotiated protocol version echoed after initialize.
    expect(calls[1]!.headers["mcp-protocol-version"]).toBe("2025-06-18");
    expect(calls[2]!.headers["mcp-protocol-version"]).toBe("2025-06-18");
  });

  it("SSE responses: notification frames are ignored, resolves on the matching id", async () => {
    const { promise } = run([
      (req) => sseResponse([
        { jsonrpc: "2.0", method: "notifications/message", params: { level: "info" } },
        { jsonrpc: "2.0", id: req.body.id, result: { protocolVersion: "2025-06-18" } },
      ]),
      emptyAck(),
      (req) => sseResponse([
        { jsonrpc: "2.0", method: "notifications/progress", params: { progress: 1 } },
        { jsonrpc: "2.0", id: req.body.id, result: { structuredContent: ENVELOPE, isError: false } },
      ]),
    ]);
    const result = await promise;
    expect(result).toMatchObject({ ok: true, raw: ENVELOPE });
  });

  it("falls back to parsing content[0].text when structuredContent is absent", async () => {
    const { promise } = run([
      initResult(),
      emptyAck(),
      toolResult({ content: [{ type: "text", text: JSON.stringify(ENVELOPE) }], isError: false }),
    ]);
    expect(await promise).toMatchObject({ ok: true, raw: ENVELOPE });
  });

  it("echoes Mcp-Session-Id on every request after initialize when issued", async () => {
    const { promise, calls } = run([
      (req) => jsonResponse(
        { jsonrpc: "2.0", id: req.body.id, result: { protocolVersion: "2025-06-18" } },
        { "mcp-session-id": "sess-123" },
      ),
      emptyAck(),
      toolResult({ structuredContent: ENVELOPE, isError: false }),
    ]);
    await promise;
    expect(calls[0]!.headers["mcp-session-id"]).toBeUndefined();
    expect(calls[1]!.headers["mcp-session-id"]).toBe("sess-123");
    expect(calls[2]!.headers["mcp-session-id"]).toBe("sess-123");
  });

  it("does NOT require a session id (spike: the server issues none)", async () => {
    const { promise, calls } = run([
      initResult(),
      emptyAck(),
      toolResult({ structuredContent: ENVELOPE, isError: false }),
    ]);
    expect((await promise).ok).toBe(true);
    expect(calls[2]!.headers["mcp-session-id"]).toBeUndefined();
  });
});

describe("fetchInterfacePages — failure isolation (every mode returns, never throws)", () => {
  it("401 → skipped(auth)", async () => {
    const { promise } = run([() => new Response("{}", { status: 401 })]);
    expect(await promise).toEqual({ ok: false, reason: "auth" });
  });

  it("403 → skipped(auth)", async () => {
    const { promise } = run([() => new Response("{}", { status: 403 })]);
    expect(await promise).toEqual({ ok: false, reason: "auth" });
  });

  it("5xx → skipped(http_500)", async () => {
    const { promise } = run([() => new Response("oops", { status: 500 })]);
    expect(await promise).toEqual({ ok: false, reason: "http_500" });
  });

  it("timeout mid-stream → skipped(timeout); one AbortController covers the exchange", async () => {
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      // Never resolves; rejects when the client's controller fires.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    }) as typeof fetch;
    const result = await fetchInterfacePages({
      baseId: BASE_ID,
      accessToken: TOKEN,
      endpoint: ENDPOINT,
      timeoutMs: 30,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  it("stream closes without the matching id → skipped(no_result)", async () => {
    const { promise } = run([
      () => sseResponse([{ jsonrpc: "2.0", method: "notifications/message", params: {} }]),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "no_result" });
  });

  it("JSON-RPC error on tools/call → skipped(rpc_error)", async () => {
    const { promise } = run([
      initResult(),
      emptyAck(),
      (req) => jsonResponse({ jsonrpc: "2.0", id: req.body.id, error: { code: -32602, message: "bad params" } }),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "rpc_error" });
  });

  it("tool result with isError → skipped(rpc_error)", async () => {
    const { promise } = run([
      initResult(),
      emptyAck(),
      toolResult({ content: [{ type: "text", text: "boom" }], isError: true }),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "rpc_error" });
  });

  it("malformed envelope → skipped(invalid_envelope)", async () => {
    const { promise } = run([
      initResult(),
      emptyAck(),
      toolResult({ structuredContent: { nope: true }, isError: false }),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "invalid_envelope" });
  });

  it("oversized payload → skipped(payload_too_large), never a partial forward", async () => {
    const huge = {
      interfaces: [{ id: "pbdX", name: "x".repeat(2 * 1024 * 1024 + 64), pages: [] }],
      standaloneForms: [],
    };
    const { promise } = run([
      initResult(),
      emptyAck(),
      toolResult({ structuredContent: huge, isError: false }),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "payload_too_large" });
  });

  it("network throw → skipped(transport)", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const result = await fetchInterfacePages({
      baseId: BASE_ID,
      accessToken: TOKEN,
      endpoint: ENDPOINT,
      timeoutMs: 1_000,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, reason: "transport" });
  });
});
