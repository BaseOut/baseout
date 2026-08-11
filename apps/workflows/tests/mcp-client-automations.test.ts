// Unit tests for fetchAutomations (workflows-mcp-automations) — the second
// consumer of the shared callMcpTool core. Same injected-fetchImpl transport
// fake as mcp-client.test.ts; that file's 15 interface-pages tests pin the
// core's behavior, so this matrix focuses on the automations wrapper: tool
// name, envelope validation, and the failure taxonomy passing through.
//
// Top-level envelope shape ({ automations: [] }) pinned by the 2026-07-24
// spike (openspec/changes/workflows-mcp-automations/README.md).

import { describe, expect, it } from "vitest";
import {
  fetchAutomations,
  type FetchAutomationsResult,
} from "../trigger/tasks/_lib/mcp-client";

const ENDPOINT = "https://mcp.example.test/mcp";
const BASE_ID = "appAAAA111122223333";
const TOKEN = "oaat_test_token";

const ENVELOPE = {
  automations: [
    { id: "wflX", name: "Notify", deploymentStatus: "enabled", trigger: { type: "recordCreated" } },
  ],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function sseResponse(frames: unknown[]): Response {
  const body = frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

interface Captured {
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

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

const initResult = () => (req: Captured) =>
  jsonResponse({
    jsonrpc: "2.0",
    id: req.body.id,
    result: {
      protocolVersion: "2025-06-18",
      serverInfo: { name: "airtable-mcp-server", version: "0.0.1" },
    },
  });

const emptyAck = () => () => new Response(null, { status: 202 });

const toolResult = (result: unknown) => (req: Captured) =>
  jsonResponse({ jsonrpc: "2.0", id: req.body.id, result });

function run(
  responders: ((req: Captured) => Response)[],
  opts: { timeoutMs?: number } = {},
): { promise: Promise<FetchAutomationsResult>; calls: Captured[] } {
  const { fetchImpl, calls } = fakeTransport(responders);
  return {
    promise: fetchAutomations({
      baseId: BASE_ID,
      accessToken: TOKEN,
      endpoint: ENDPOINT,
      timeoutMs: opts.timeoutMs ?? 5_000,
      fetchImpl,
    }),
    calls,
  };
}

describe("fetchAutomations — happy paths", () => {
  it("plain-JSON: full handshake calls list_automations and returns the envelope", async () => {
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
    expect(calls[2]!.body).toMatchObject({
      method: "tools/call",
      params: { name: "list_automations", arguments: { baseId: BASE_ID } },
    });
  });

  it("SSE result with notification frames resolves on the matching id", async () => {
    const { promise } = run([
      initResult(),
      emptyAck(),
      (req) =>
        sseResponse([
          { jsonrpc: "2.0", method: "notifications/progress", params: {} },
          {
            jsonrpc: "2.0",
            id: req.body.id,
            result: { structuredContent: ENVELOPE, content: [], isError: false },
          },
        ]),
    ]);
    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.raw).toEqual(ENVELOPE);
  });

  it("falls back to parsing content[0].text when structuredContent is absent", async () => {
    const { promise } = run([
      initResult(),
      emptyAck(),
      toolResult({ content: [{ type: "text", text: JSON.stringify(ENVELOPE) }], isError: false }),
    ]);
    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.raw).toEqual(ENVELOPE);
  });

  it("an empty automations array is a valid (empty) capture — the dev-base fixture", async () => {
    const { promise } = run([
      initResult(),
      emptyAck(),
      toolResult({ structuredContent: { automations: [] }, content: [], isError: false }),
    ]);
    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.raw).toEqual({ automations: [] });
  });
});

describe("fetchAutomations — failure taxonomy", () => {
  it("401 on any hop maps to auth", async () => {
    const { promise } = run([() => new Response("nope", { status: 401 })]);
    expect(await promise).toEqual({ ok: false, reason: "auth" });
  });

  it("5xx maps to http_<n>", async () => {
    const { promise } = run([initResult(), emptyAck(), () => new Response("boom", { status: 503 })]);
    expect(await promise).toEqual({ ok: false, reason: "http_503" });
  });

  it("an envelope without automations[] is invalid_envelope", async () => {
    const { promise } = run([
      initResult(),
      emptyAck(),
      toolResult({ structuredContent: { interfaces: [] }, content: [], isError: false }),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "invalid_envelope" });
  });

  it("tool isError result maps to rpc_error", async () => {
    const { promise } = run([
      initResult(),
      emptyAck(),
      toolResult({ isError: true, content: [{ type: "text", text: "denied" }] }),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "rpc_error" });
  });

  it("transport throw maps to transport", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const result = await fetchAutomations({
      baseId: BASE_ID,
      accessToken: TOKEN,
      endpoint: ENDPOINT,
      timeoutMs: 5_000,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, reason: "transport" });
  });

  it("oversized payload maps to payload_too_large", async () => {
    const big = { automations: [{ id: "wflX", name: "x".repeat(2 * 1024 * 1024 + 10) }] };
    const { promise } = run([
      initResult(),
      emptyAck(),
      toolResult({ structuredContent: big, content: [], isError: false }),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "payload_too_large" });
  });
});
