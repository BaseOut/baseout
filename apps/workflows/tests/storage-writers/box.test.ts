// Unit tests for BoxWriter — second cloud StorageWriter implementation
// (box-provider commit chain, 3/3).
//
// All Box HTTP is mocked via a fake fetch that records calls and returns
// canned responses. Tests cover:
//   - happy writeCsv: list (miss) → create folder → multipart upload
//   - sub-folder lookup-then-create caching across calls
//   - 409 conflict → new-version POST
//   - reactive refresh on 401 mid-request
//   - path-traversal rejection
//   - deletePrefix happy path (recursive=true)
//   - deletePrefix on missing path returns 0 (idempotent)
//   - deletePrefix on root prefix rejected

import { describe, expect, it, vi } from "vitest";
import {
  createBoxWriter,
  type BoxWriterCreds,
} from "../../trigger/tasks/_lib/storage-writers/box";

interface MockCall {
  url: string;
  init: RequestInit;
}

function makeFakeFetch(
  scripted: Array<(call: MockCall) => Response | Promise<Response>>,
): { fetchImpl: typeof fetch; calls: MockCall[] } {
  const calls: MockCall[] = [];
  let idx = 0;
  const fetchImpl = (async (
    input: string | URL | Request,
    init: RequestInit = {},
  ) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    const handler = scripted[idx++];
    if (!handler) throw new Error(`unexpected fetch #${idx} to ${url}`);
    return handler({ url, init });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const FAR_FUTURE = new Date(Date.now() + 60 * 60_000);

function makeCreds(overrides: Partial<BoxWriterCreds> = {}): BoxWriterCreds {
  return {
    accessToken: "at_initial",
    expiresAt: FAR_FUTURE,
    providerFolderId: "root_folder",
    refresh: vi.fn(async () => ({
      accessToken: "at_refreshed",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    })),
    ...overrides,
  };
}

describe("createBoxWriter.writeCsv", () => {
  it("lists (miss) → creates sub-folder → uploads via multipart for each segment", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      // 1. list root for "run_a" — miss
      () => json({ entries: [], total_count: 0 }),
      // 2. create "run_a"
      () => json({ type: "folder", id: "folder_run_a", name: "run_a" }),
      // 3. list folder_run_a for "base_x" — miss
      () => json({ entries: [], total_count: 0 }),
      // 4. create "base_x"
      () => json({ type: "folder", id: "folder_base_x", name: "base_x" }),
      // 5. upload — 201 with entries[0].id
      () =>
        json(
          { entries: [{ type: "file", id: "file_99", name: "table.csv" }] },
          { status: 201 },
        ),
    ]);

    const writer = createBoxWriter({ creds: makeCreds(), fetchImpl });
    const result = await writer.writeCsv("run_a/base_x/table.csv", "col\n1");

    expect(result.path).toBe("box://folder_base_x/table.csv");
    // "col\n1" → 5 bytes (\n is one byte).
    expect(result.size).toBe(5);
    expect(calls).toHaveLength(5);

    // List #1 hits /folders/root_folder/items
    expect(calls[0]!.url).toContain("/folders/root_folder/items");
    expect(calls[0]!.url).toContain("limit=1000");
    // Create #1 is POST /folders with parent.id = root_folder
    expect(calls[1]!.url).toContain("/folders");
    expect(calls[1]!.init.method).toBe("POST");
    const create1Body = JSON.parse(calls[1]!.init.body as string);
    expect(create1Body.name).toBe("run_a");
    expect(create1Body.parent).toEqual({ id: "root_folder" });
    // List #2 hits /folders/folder_run_a/items
    expect(calls[2]!.url).toContain("/folders/folder_run_a/items");
    // Create #2 has parent.id = folder_run_a
    const create2Body = JSON.parse(calls[3]!.init.body as string);
    expect(create2Body.parent).toEqual({ id: "folder_run_a" });
    // Upload hits the upload subdomain at /files/content
    expect(calls[4]!.url).toContain("upload.box.com");
    expect(calls[4]!.url).toContain("/files/content");
    expect(calls[4]!.init.method).toBe("POST");
    // Authorization is set on every call.
    for (const c of calls) {
      const h = new Headers(c.init.headers);
      expect(h.get("authorization")).toBe("Bearer at_initial");
    }
  });

  it("caches sub-folder IDs across calls so a second writeCsv under the same prefix doesn't re-list", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      // First call: list (hit) for "run_a"
      () =>
        json({
          entries: [
            { type: "folder", id: "folder_run_a_existing", name: "run_a" },
          ],
        }),
      // Upload #1
      () =>
        json(
          { entries: [{ type: "file", id: "f1", name: "a.csv" }] },
          { status: 201 },
        ),
      // Second call: NO list (cache hit on "run_a") — straight to upload #2
      () =>
        json(
          { entries: [{ type: "file", id: "f2", name: "b.csv" }] },
          { status: 201 },
        ),
    ]);

    const writer = createBoxWriter({ creds: makeCreds(), fetchImpl });
    await writer.writeCsv("run_a/a.csv", "a");
    await writer.writeCsv("run_a/b.csv", "b");

    expect(calls).toHaveLength(3);
    expect(calls[0]!.url).toContain("/folders/root_folder/items");
    expect(calls[1]!.url).toContain("/files/content");
    expect(calls[2]!.url).toContain("/files/content");
  });

  it("on 409 conflict, POSTs to /files/:id/content with the conflict id (new version)", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      // Upload — 409 conflict, body has context_info.conflicts[0].id
      () =>
        new Response(
          JSON.stringify({
            type: "error",
            status: 409,
            context_info: { conflicts: [{ type: "file", id: "existing_321" }] },
          }),
          {
            status: 409,
            headers: { "content-type": "application/json" },
          },
        ),
      // New-version upload — 200 OK
      () =>
        json(
          { entries: [{ type: "file", id: "existing_321", name: "t.csv" }] },
          { status: 200 },
        ),
    ]);

    const writer = createBoxWriter({ creds: makeCreds(), fetchImpl });
    const result = await writer.writeCsv("t.csv", "hello");

    expect(result.path).toBe("box://root_folder/t.csv");
    expect(calls[1]!.url).toContain("/files/existing_321/content");
    expect(calls[1]!.init.method).toBe("POST");
  });

  it("reactive refresh on 401 — retries the request once with the new access token", async () => {
    const refreshFn = vi.fn(async () => ({
      accessToken: "at_after_refresh",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    }));
    const { fetchImpl, calls } = makeFakeFetch([
      // 1. list — 401
      () => new Response("", { status: 401 }),
      // 2. list retry — hit
      () =>
        json({
          entries: [{ type: "folder", id: "folder_run_a", name: "run_a" }],
        }),
      // 3. upload — ok
      () =>
        json(
          { entries: [{ type: "file", id: "f1", name: "a.csv" }] },
          { status: 201 },
        ),
    ]);

    const writer = createBoxWriter({
      creds: makeCreds({ refresh: refreshFn }),
      fetchImpl,
    });
    await writer.writeCsv("run_a/a.csv", "a");

    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(3);
    // After refresh, the retry uses the new bearer.
    const retryHeaders = new Headers(calls[1]!.init.headers);
    expect(retryHeaders.get("authorization")).toBe("Bearer at_after_refresh");
  });

  it("proactive refresh — when expiresAt is within 5 minutes, refresh runs before the first request", async () => {
    const refreshFn = vi.fn(async () => ({
      accessToken: "at_proactive",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    }));
    const { fetchImpl, calls } = makeFakeFetch([
      () =>
        json({
          entries: [{ type: "folder", id: "folder_run_a", name: "run_a" }],
        }),
      () =>
        json(
          { entries: [{ type: "file", id: "f1", name: "a.csv" }] },
          { status: 201 },
        ),
    ]);

    const writer = createBoxWriter({
      creds: makeCreds({
        expiresAt: new Date(Date.now() + 30_000), // 30 sec to expiry
        refresh: refreshFn,
      }),
      fetchImpl,
    });
    await writer.writeCsv("run_a/a.csv", "a");

    expect(refreshFn).toHaveBeenCalledTimes(1);
    const listHeaders = new Headers(calls[0]!.init.headers);
    expect(listHeaders.get("authorization")).toBe("Bearer at_proactive");
  });

  it("rejects path-traversal in relativeKey", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createBoxWriter({ creds: makeCreds(), fetchImpl });
    await expect(writer.writeCsv("../escape.csv", "x")).rejects.toThrow(
      /invalid_path/,
    );
    await expect(writer.writeCsv("a/../b/c.csv", "x")).rejects.toThrow(
      /invalid_path/,
    );
  });

  it("rejects empty relativeKey", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createBoxWriter({ creds: makeCreds(), fetchImpl });
    await expect(writer.writeCsv("", "x")).rejects.toThrow(/invalid_path/);
    await expect(writer.writeCsv("/", "x")).rejects.toThrow(/invalid_path/);
  });
});

describe("createBoxWriter.deletePrefix", () => {
  it("happy path — walks segments, then DELETE /folders/:id?recursive=true", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      // List root, find "run_a"
      () =>
        json({
          entries: [{ type: "folder", id: "folder_run_a", name: "run_a" }],
        }),
      // List folder_run_a, find "base_x"
      () =>
        json({
          entries: [{ type: "folder", id: "folder_base_x", name: "base_x" }],
        }),
      // DELETE folder_base_x with recursive=true → 204
      () => new Response(null, { status: 204 }),
    ]);

    const writer = createBoxWriter({ creds: makeCreds(), fetchImpl });
    const result = await writer.deletePrefix("run_a/base_x");

    expect(result.deletedCount).toBe(1);
    expect(calls[2]!.url).toContain("/folders/folder_base_x");
    expect(calls[2]!.url).toContain("recursive=true");
    expect(calls[2]!.init.method).toBe("DELETE");
  });

  it("missing prefix returns 0 (idempotent)", async () => {
    const { fetchImpl } = makeFakeFetch([
      // List root — no matching folder
      () => json({ entries: [] }),
    ]);

    const writer = createBoxWriter({ creds: makeCreds(), fetchImpl });
    const result = await writer.deletePrefix("run_a");
    expect(result.deletedCount).toBe(0);
  });

  it("rejects root prefix (would un-connect the destination)", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createBoxWriter({ creds: makeCreds(), fetchImpl });
    await expect(writer.deletePrefix("")).rejects.toThrow(/invalid_path/);
    await expect(writer.deletePrefix("/")).rejects.toThrow(/invalid_path/);
  });

  it("rejects path-traversal", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createBoxWriter({ creds: makeCreds(), fetchImpl });
    await expect(writer.deletePrefix("run_a/../escape")).rejects.toThrow(
      /invalid_path/,
    );
  });

  it("treats DELETE 404 as 0 (folder already gone — still idempotent)", async () => {
    const { fetchImpl } = makeFakeFetch([
      () =>
        json({
          entries: [{ type: "folder", id: "folder_run_a", name: "run_a" }],
        }),
      () => new Response(null, { status: 404 }),
    ]);

    const writer = createBoxWriter({ creds: makeCreds(), fetchImpl });
    const result = await writer.deletePrefix("run_a");
    expect(result.deletedCount).toBe(0);
  });
});
