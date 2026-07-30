// Unit tests for fetchViews (workflows-mcp-views task 1.1) — the third
// consumer of the shared MCP session core. Same injected-fetchImpl transport
// fake as mcp-client.test.ts / mcp-client-automations.test.ts; those matrices
// pin the core's behavior, so this one focuses on the views wrapper: the
// PER-TABLE fan-out on a single handshake, per-table envelope validation, the
// ALL-OR-SKIP aggregation rule, and the failure taxonomy passing through.
//
// Tool name (`list_views_for_table`, args {baseId, tableId}) + top-level
// envelope shape ({ views: [{id, name, type}] }) pinned by the 2026-07-27
// spike (openspec/changes/workflows-mcp-views/README.md).

import { describe, expect, it } from "vitest";
import {
  fetchViews,
  type FetchViewsResult,
} from "../trigger/tasks/_lib/mcp-client";

const ENDPOINT = "https://mcp.example.test/mcp";
const BASE_ID = "appAAAA111122223333";
const TOKEN = "oaat_test_token";

const VIEWS_TBL1 = { views: [{ id: "viwAAA", name: "Grid view", type: "grid" }] };
const VIEWS_TBL2 = {
  views: [
    { id: "viwBBB", name: "Kanban", type: "kanban" },
    { id: "viwCCC", name: "Calendar", type: "calendar" },
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

const viewsResult = (envelope: unknown) =>
  toolResult({ structuredContent: envelope, content: [], isError: false });

function run(
  responders: ((req: Captured) => Response)[],
  opts: { tableIds?: string[]; timeoutMs?: number } = {},
): { promise: Promise<FetchViewsResult>; calls: Captured[] } {
  const { fetchImpl, calls } = fakeTransport(responders);
  return {
    promise: fetchViews({
      baseId: BASE_ID,
      tableIds: opts.tableIds ?? ["tbl1", "tbl2"],
      accessToken: TOKEN,
      endpoint: ENDPOINT,
      timeoutMs: opts.timeoutMs ?? 5_000,
      fetchImpl,
    }),
    calls,
  };
}

describe("fetchViews — happy paths", () => {
  it("fans out one list_views_for_table call per table on a SINGLE handshake", async () => {
    const { promise, calls } = run([
      initResult(),
      emptyAck(),
      viewsResult(VIEWS_TBL1),
      viewsResult(VIEWS_TBL2),
    ]);
    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.capture.tables).toEqual([
      { tableId: "tbl1", raw: VIEWS_TBL1 },
      { tableId: "tbl2", raw: VIEWS_TBL2 },
    ]);
    expect(Date.parse(result.capture.capturedAt)).not.toBeNaN();

    // ONE initialize + ONE initialized ack + N tools/call — no re-handshake.
    expect(calls).toHaveLength(4);
    expect(calls[0]!.body.method).toBe("initialize");
    expect(calls[1]!.body.method).toBe("notifications/initialized");
    expect(calls[2]!.body).toMatchObject({
      method: "tools/call",
      params: { name: "list_views_for_table", arguments: { baseId: BASE_ID, tableId: "tbl1" } },
    });
    expect(calls[3]!.body).toMatchObject({
      method: "tools/call",
      params: { name: "list_views_for_table", arguments: { baseId: BASE_ID, tableId: "tbl2" } },
    });
  });

  it("SSE results with notification frames resolve on the matching id", async () => {
    const { promise } = run(
      [
        initResult(),
        emptyAck(),
        (req) =>
          sseResponse([
            { jsonrpc: "2.0", method: "notifications/progress", params: {} },
            {
              jsonrpc: "2.0",
              id: req.body.id,
              result: { structuredContent: VIEWS_TBL1, content: [], isError: false },
            },
          ]),
      ],
      { tableIds: ["tbl1"] },
    );
    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.capture.tables).toEqual([{ tableId: "tbl1", raw: VIEWS_TBL1 }]);
  });

  it("an empty views array is a valid (empty) per-table capture", async () => {
    const { promise } = run([initResult(), emptyAck(), viewsResult({ views: [] })], {
      tableIds: ["tbl1"],
    });
    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.capture.tables).toEqual([{ tableId: "tbl1", raw: { views: [] } }]);
  });

  it("zero tables resolves ok with ZERO network calls", async () => {
    const { promise, calls } = run([], { tableIds: [] });
    const result = await promise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.capture.tables).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe("fetchViews — failure taxonomy + all-or-skip", () => {
  it("401 on any hop maps to auth", async () => {
    const { promise } = run([() => new Response("nope", { status: 401 })]);
    expect(await promise).toEqual({ ok: false, reason: "auth" });
  });

  it("timeout mid-fan-out → skipped(timeout); one AbortController covers the session", async () => {
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    }) as typeof fetch;
    const result = await fetchViews({
      baseId: BASE_ID,
      tableIds: ["tbl1", "tbl2"],
      accessToken: TOKEN,
      endpoint: ENDPOINT,
      timeoutMs: 30,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  it("a per-table envelope without views[] skips the WHOLE capture (invalid_envelope)", async () => {
    const { promise } = run([
      initResult(),
      emptyAck(),
      viewsResult(VIEWS_TBL1),
      viewsResult({ tables: [] }), // second table's envelope malformed
    ]);
    // All-or-skip: tbl1 succeeded, but partial view visibility would trigger
    // false removals server-side — no partial result may escape.
    expect(await promise).toEqual({ ok: false, reason: "invalid_envelope" });
  });

  it("a mid-fan-out HTTP 500 skips the WHOLE capture (http_500), no partial", async () => {
    const { promise, calls } = run([
      initResult(),
      emptyAck(),
      viewsResult(VIEWS_TBL1),
      () => new Response("boom", { status: 500 }),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "http_500" });
    expect(calls).toHaveLength(4);
  });

  it("a mid-fan-out tool isError result maps to rpc_error, whole capture skipped", async () => {
    const { promise } = run([
      initResult(),
      emptyAck(),
      viewsResult(VIEWS_TBL1),
      toolResult({ isError: true, content: [{ type: "text", text: "denied" }] }),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "rpc_error" });
  });

  it("oversized per-table payload maps to payload_too_large", async () => {
    const big = { views: [{ id: "viwX", name: "x".repeat(2 * 1024 * 1024 + 10), type: "grid" }] };
    const { promise } = run([initResult(), emptyAck(), viewsResult(big)], {
      tableIds: ["tbl1"],
    });
    expect(await promise).toEqual({ ok: false, reason: "payload_too_large" });
  });

  it("transport throw maps to transport", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const result = await fetchViews({
      baseId: BASE_ID,
      tableIds: ["tbl1"],
      accessToken: TOKEN,
      endpoint: ENDPOINT,
      timeoutMs: 5_000,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, reason: "transport" });
  });
});
