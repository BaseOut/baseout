// Unit tests for fetchRecordComments (workflows-comments task 2.2) — the
// per-record comments fetcher used by the backup task's comment capture step.
//
// Endpoint + envelope pinned by the 2026-07-27 spike
// (openspec/changes/workflows-comments/README.md):
//   GET /v0/{baseId}/{tableId}/{recordId}/comments → { comments: [], offset }
//   (offset null on the final page; pagination via ?offset=…).
// Pacing mirrors the airtable-client conventions: 3 total attempts on
// 429/5xx, Retry-After honored, exponential backoff otherwise, non-retriable
// 4xx surfaces immediately. The helper NEVER throws — every failure maps to
// { ok: false, reason } so the capture step's isolation contract holds.

import { describe, expect, it, vi } from "vitest";
import {
  fetchRecordComments,
  type FetchRecordCommentsResult,
} from "../trigger/tasks/_lib/record-comments";

const BASE_ID = "appAAAA111122223333";
const TABLE_ID = "tblTTTT111122223333";
const RECORD_ID = "recRRRR111122223333";
const TOKEN = "oaat_test_token";

const COMMENT_1 = { id: "comAAA", text: "First!", author: { id: "usrX" }, createdTime: "2026-07-01T00:00:00.000Z" };
const COMMENT_2 = { id: "comBBB", text: "Second", author: { id: "usrY" }, createdTime: "2026-07-02T00:00:00.000Z" };

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function makeTransport(responders: ((url: string) => Response)[]): {
  fetchImpl: typeof fetch;
  urls: string[];
} {
  const urls: string[] = [];
  const fetchImpl = (async (input: Parameters<typeof fetch>[0]) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    urls.push(url);
    const responder = responders.shift();
    if (!responder) throw new Error("fake transport exhausted");
    return responder(url);
  }) as typeof fetch;
  return { fetchImpl, urls };
}

function run(
  responders: ((url: string) => Response)[],
): { promise: Promise<FetchRecordCommentsResult>; urls: string[]; sleeps: number[] } {
  const { fetchImpl, urls } = makeTransport(responders);
  const sleeps: number[] = [];
  const sleepImpl = vi.fn(async (ms: number) => {
    sleeps.push(ms);
  });
  return {
    promise: fetchRecordComments({
      baseId: BASE_ID,
      tableId: TABLE_ID,
      recordId: RECORD_ID,
      accessToken: TOKEN,
      fetchImpl,
      sleepImpl,
    }),
    urls,
    sleeps,
  };
}

describe("fetchRecordComments — pagination", () => {
  it("single page (offset null) resolves with the comments", async () => {
    const { promise, urls } = run([() => jsonResponse({ comments: [COMMENT_1], offset: null })]);
    const result = await promise;
    expect(result).toEqual({ ok: true, comments: [COMMENT_1] });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${RECORD_ID}/comments?pageSize=100`,
    );
  });

  it("multi-page: follows the offset cursor to completion", async () => {
    const { promise, urls } = run([
      () => jsonResponse({ comments: [COMMENT_1], offset: "cursor1" }),
      () => jsonResponse({ comments: [COMMENT_2], offset: null }),
    ]);
    const result = await promise;
    expect(result).toEqual({ ok: true, comments: [COMMENT_1, COMMENT_2] });
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain("offset=cursor1");
  });

  it("an empty comments list is a valid (empty) capture", async () => {
    const { promise } = run([() => jsonResponse({ comments: [], offset: null })]);
    expect(await promise).toEqual({ ok: true, comments: [] });
  });
});

describe("fetchRecordComments — pacing + failure shapes", () => {
  it("429 retries (honoring Retry-After) then succeeds", async () => {
    const { promise, sleeps } = run([
      () => jsonResponse({ error: "rate_limited" }, 429, { "retry-after": "2" }),
      () => jsonResponse({ comments: [COMMENT_1], offset: null }),
    ]);
    const result = await promise;
    expect(result).toEqual({ ok: true, comments: [COMMENT_1] });
    expect(sleeps).toEqual([2000]);
  });

  it("429 exhausted after 3 attempts → { ok: false, reason: 'http_429' }", async () => {
    const { promise, urls, sleeps } = run([
      () => jsonResponse({ error: "rate_limited" }, 429),
      () => jsonResponse({ error: "rate_limited" }, 429),
      () => jsonResponse({ error: "rate_limited" }, 429),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "http_429" });
    expect(urls).toHaveLength(3);
    // Exponential backoff fallback when Retry-After is absent (200ms, 800ms).
    expect(sleeps).toEqual([200, 800]);
  });

  it("5xx is retried, then reported as http_<n> when exhausted", async () => {
    const { promise, urls } = run([
      () => jsonResponse({ error: "boom" }, 502),
      () => jsonResponse({ error: "boom" }, 502),
      () => jsonResponse({ error: "boom" }, 502),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "http_502" });
    expect(urls).toHaveLength(3);
  });

  it("non-retriable 4xx (403) surfaces immediately without retry", async () => {
    const { promise, urls } = run([() => jsonResponse({ error: "forbidden" }, 403)]);
    expect(await promise).toEqual({ ok: false, reason: "http_403" });
    expect(urls).toHaveLength(1);
  });

  it("mid-pagination failure loses the whole record (no partial ok)", async () => {
    const { promise } = run([
      () => jsonResponse({ comments: [COMMENT_1], offset: "cursor1" }),
      () => jsonResponse({ error: "gone" }, 404),
    ]);
    expect(await promise).toEqual({ ok: false, reason: "http_404" });
  });

  it("transport throw maps to transport", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNRESET");
    }) as typeof fetch;
    const result = await fetchRecordComments({
      baseId: BASE_ID,
      tableId: TABLE_ID,
      recordId: RECORD_ID,
      accessToken: TOKEN,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, reason: "transport" });
  });

  it("a body without comments[] maps to invalid_response", async () => {
    const { promise } = run([() => jsonResponse({ records: [] })]);
    expect(await promise).toEqual({ ok: false, reason: "invalid_response" });
  });
});
