// Unit tests for DropboxWriter — third cloud StorageWriter implementation
// (dropbox-provider commit chain, 3/3).
//
// All Dropbox HTTP is mocked via a fake fetch that records calls and
// returns canned responses. Tests cover:
//   - happy writeCsv: create each ancestor folder → upload via
//     /2/files/upload with Dropbox-API-Arg + mode: 'overwrite'
//   - folder-path caching across calls
//   - path/conflict_folder error on create_folder_v2 → idempotent success
//   - reactive refresh on 401 mid-request
//   - proactive refresh when near-expiry
//   - path-traversal rejection
//   - deletePrefix happy path (single POST to /2/files/delete_v2)
//   - deletePrefix on missing path → idempotent 0
//   - deletePrefix on root prefix rejected
//   - mode=overwrite encoded in Dropbox-API-Arg

import { describe, expect, it, vi } from "vitest";
import {
  createDropboxWriter,
  type DropboxWriterCreds,
} from "../../trigger/tasks/_lib/storage-writers/dropbox";

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

function makeCreds(
  overrides: Partial<DropboxWriterCreds> = {},
): DropboxWriterCreds {
  return {
    accessToken: "sl.at_initial",
    expiresAt: FAR_FUTURE,
    providerFolderId: "/Baseout-sp1",
    refresh: vi.fn(async () => ({
      accessToken: "sl.at_refreshed",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    })),
    ...overrides,
  };
}

describe("createDropboxWriter.writeCsv", () => {
  it("creates each ancestor folder under root, then uploads via /2/files/upload with Dropbox-API-Arg + mode: overwrite", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      // 1. create_folder_v2 for "/Baseout-sp1/run_a"
      () =>
        json({ metadata: { path_display: "/Baseout-sp1/run_a" } }),
      // 2. create_folder_v2 for "/Baseout-sp1/run_a/base_x"
      () =>
        json({ metadata: { path_display: "/Baseout-sp1/run_a/base_x" } }),
      // 3. upload at "/Baseout-sp1/run_a/base_x/table.csv"
      () =>
        json({
          id: "id:file_99",
          name: "table.csv",
          path_display: "/Baseout-sp1/run_a/base_x/table.csv",
        }),
    ]);

    const writer = createDropboxWriter({ creds: makeCreds(), fetchImpl });
    const result = await writer.writeCsv("run_a/base_x/table.csv", "col\n1");

    expect(result.path).toBe(
      "dropbox:///Baseout-sp1/run_a/base_x/table.csv",
    );
    // "col\n1" → 5 bytes (\n is one byte).
    expect(result.size).toBe(5);
    expect(calls).toHaveLength(3);

    // Verify create #1 body
    expect(calls[0]!.url).toContain("/files/create_folder_v2");
    const create1 = JSON.parse(calls[0]!.init.body as string);
    expect(create1.path).toBe("/Baseout-sp1/run_a");
    expect(create1.autorename).toBe(false);

    // Verify create #2 has the nested path
    const create2 = JSON.parse(calls[1]!.init.body as string);
    expect(create2.path).toBe("/Baseout-sp1/run_a/base_x");

    // Verify upload hits the content subdomain, with octet-stream body +
    // mode: 'overwrite' encoded in the Dropbox-API-Arg header.
    expect(calls[2]!.url).toContain("content.dropboxapi.com");
    expect(calls[2]!.url).toContain("/files/upload");
    expect(calls[2]!.init.method).toBe("POST");
    const uploadHeaders = new Headers(calls[2]!.init.headers);
    expect(uploadHeaders.get("content-type")).toBe(
      "application/octet-stream",
    );
    expect(uploadHeaders.get("authorization")).toBe("Bearer sl.at_initial");
    const arg = JSON.parse(uploadHeaders.get("dropbox-api-arg") ?? "{}");
    expect(arg.path).toBe("/Baseout-sp1/run_a/base_x/table.csv");
    expect(arg.mode).toBe("overwrite");
    expect(arg.autorename).toBe(false);
  });

  it("caches created folder paths so a second writeCsv under the same prefix does NOT re-create ancestors", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      // First call: create folder + upload
      () => json({ metadata: { path_display: "/Baseout-sp1/run_a" } }),
      () => json({ id: "f1", path_display: "/Baseout-sp1/run_a/a.csv" }),
      // Second call: just upload (folder cached)
      () => json({ id: "f2", path_display: "/Baseout-sp1/run_a/b.csv" }),
    ]);

    const writer = createDropboxWriter({ creds: makeCreds(), fetchImpl });
    await writer.writeCsv("run_a/a.csv", "a");
    await writer.writeCsv("run_a/b.csv", "b");

    expect(calls).toHaveLength(3);
    expect(calls[0]!.url).toContain("/files/create_folder_v2");
    expect(calls[1]!.url).toContain("/files/upload");
    expect(calls[2]!.url).toContain("/files/upload");
  });

  it("treats Dropbox 409 path/conflict_folder on create_folder_v2 as idempotent success", async () => {
    // The shared folder already exists from a prior writer instance — Dropbox
    // returns 409 with path/conflict_folder. We continue without erroring.
    const { fetchImpl, calls } = makeFakeFetch([
      () =>
        new Response(
          JSON.stringify({
            error_summary: "path/conflict/folder/.",
            error: {
              ".tag": "path",
              path: { ".tag": "conflict", conflict: { ".tag": "folder" } },
            },
          }),
          {
            status: 409,
            headers: { "content-type": "application/json" },
          },
        ),
      () => json({ id: "f1", path_display: "/Baseout-sp1/run_a/a.csv" }),
    ]);

    const writer = createDropboxWriter({ creds: makeCreds(), fetchImpl });
    const result = await writer.writeCsv("run_a/a.csv", "a");
    expect(result.path).toBe("dropbox:///Baseout-sp1/run_a/a.csv");
    expect(calls).toHaveLength(2);
  });

  it("reactive refresh on 401 — retries the request once with the new access token", async () => {
    const refreshFn = vi.fn(async () => ({
      accessToken: "sl.at_after_refresh",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    }));
    const { fetchImpl, calls } = makeFakeFetch([
      // 1. create folder — 401
      () => new Response("", { status: 401 }),
      // 2. retry create — ok
      () => json({ metadata: { path_display: "/Baseout-sp1/run_a" } }),
      // 3. upload — ok
      () => json({ id: "f1", path_display: "/Baseout-sp1/run_a/a.csv" }),
    ]);

    const writer = createDropboxWriter({
      creds: makeCreds({ refresh: refreshFn }),
      fetchImpl,
    });
    await writer.writeCsv("run_a/a.csv", "a");

    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(3);
    const retryHeaders = new Headers(calls[1]!.init.headers);
    expect(retryHeaders.get("authorization")).toBe(
      "Bearer sl.at_after_refresh",
    );
  });

  it("proactive refresh — when expiresAt is within 5 minutes, refresh runs before the first request", async () => {
    const refreshFn = vi.fn(async () => ({
      accessToken: "sl.at_proactive",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    }));
    const { fetchImpl, calls } = makeFakeFetch([
      () => json({ metadata: { path_display: "/Baseout-sp1/run_a" } }),
      () => json({ id: "f1", path_display: "/Baseout-sp1/run_a/a.csv" }),
    ]);

    const writer = createDropboxWriter({
      creds: makeCreds({
        expiresAt: new Date(Date.now() + 30_000), // 30 sec to expiry
        refresh: refreshFn,
      }),
      fetchImpl,
    });
    await writer.writeCsv("run_a/a.csv", "a");

    expect(refreshFn).toHaveBeenCalledTimes(1);
    const firstHeaders = new Headers(calls[0]!.init.headers);
    expect(firstHeaders.get("authorization")).toBe("Bearer sl.at_proactive");
  });

  it("rejects path-traversal in relativeKey", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createDropboxWriter({ creds: makeCreds(), fetchImpl });
    await expect(writer.writeCsv("../escape.csv", "x")).rejects.toThrow(
      /invalid_path/,
    );
    await expect(writer.writeCsv("a/../b/c.csv", "x")).rejects.toThrow(
      /invalid_path/,
    );
  });

  it("rejects empty relativeKey", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createDropboxWriter({ creds: makeCreds(), fetchImpl });
    await expect(writer.writeCsv("", "x")).rejects.toThrow(/invalid_path/);
    await expect(writer.writeCsv("/", "x")).rejects.toThrow(/invalid_path/);
  });

  it("rejects creds.providerFolderId that doesn't start with /", () => {
    expect(() =>
      createDropboxWriter({
        creds: makeCreds({ providerFolderId: "Baseout-sp1" }),
      }),
    ).toThrow(/absolute Dropbox path/);
  });
});

describe("createDropboxWriter.writeBlob", () => {
  it("creates each ancestor folder under root, then uploads arbitrary bytes via /2/files/upload — size equals the byte length", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      // 1. create_folder_v2 for "/Baseout-sp1/run_a"
      () => json({ metadata: { path_display: "/Baseout-sp1/run_a" } }),
      // 2. create_folder_v2 for "/Baseout-sp1/run_a/base_x"
      () =>
        json({ metadata: { path_display: "/Baseout-sp1/run_a/base_x" } }),
      // 3. upload at "/Baseout-sp1/run_a/base_x/photo.png"
      () =>
        json({
          id: "id:file_blob",
          name: "photo.png",
          path_display: "/Baseout-sp1/run_a/base_x/photo.png",
        }),
    ]);

    const writer = createDropboxWriter({ creds: makeCreds(), fetchImpl });
    const body = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const result = await writer.writeBlob(
      "run_a/base_x/photo.png",
      body,
      "image/png",
    );

    expect(result.path).toBe(
      "dropbox:///Baseout-sp1/run_a/base_x/photo.png",
    );
    expect(result.size).toBe(body.byteLength);
    expect(calls).toHaveLength(3);

    // Verify the content upload POST occurred against the content subdomain
    // with the octet-stream body + path encoded in the Dropbox-API-Arg header.
    expect(calls[2]!.url).toContain("content.dropboxapi.com");
    expect(calls[2]!.url).toContain("/files/upload");
    expect(calls[2]!.init.method).toBe("POST");
    const uploadHeaders = new Headers(calls[2]!.init.headers);
    expect(uploadHeaders.get("content-type")).toBe(
      "application/octet-stream",
    );
    const arg = JSON.parse(uploadHeaders.get("dropbox-api-arg") ?? "{}");
    expect(arg.path).toBe("/Baseout-sp1/run_a/base_x/photo.png");
    expect(arg.mode).toBe("overwrite");
  });

  it("rejects path-traversal in relativeKey", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createDropboxWriter({ creds: makeCreds(), fetchImpl });
    const body = new Uint8Array([1, 2, 3]);
    await expect(
      writer.writeBlob("../escape.png", body, "image/png"),
    ).rejects.toThrow(/invalid_path/);
    await expect(
      writer.writeBlob("a/../b/c.png", body, "image/png"),
    ).rejects.toThrow(/invalid_path/);
  });
});

describe("createDropboxWriter.deletePrefix", () => {
  it("happy path — single POST to /2/files/delete_v2 with the full path", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      () => json({ metadata: { path_display: "/Baseout-sp1/run_a" } }),
    ]);

    const writer = createDropboxWriter({ creds: makeCreds(), fetchImpl });
    const result = await writer.deletePrefix("run_a");

    expect(result.deletedCount).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain("/files/delete_v2");
    expect(calls[0]!.init.method).toBe("POST");
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.path).toBe("/Baseout-sp1/run_a");
  });

  it("missing prefix → idempotent 0 (path/not_found is treated as success)", async () => {
    const { fetchImpl } = makeFakeFetch([
      () =>
        new Response(
          JSON.stringify({
            error_summary: "path_lookup/not_found/.",
            error: { ".tag": "path_lookup" },
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
    ]);

    const writer = createDropboxWriter({ creds: makeCreds(), fetchImpl });
    const result = await writer.deletePrefix("run_a");
    expect(result.deletedCount).toBe(0);
  });

  it("rejects root prefix (would un-connect the destination)", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createDropboxWriter({ creds: makeCreds(), fetchImpl });
    await expect(writer.deletePrefix("")).rejects.toThrow(/invalid_path/);
    await expect(writer.deletePrefix("/")).rejects.toThrow(/invalid_path/);
  });

  it("rejects path-traversal", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createDropboxWriter({ creds: makeCreds(), fetchImpl });
    await expect(writer.deletePrefix("run_a/../escape")).rejects.toThrow(
      /invalid_path/,
    );
  });

  it("prunes the folder cache for the deleted prefix so a subsequent writeCsv re-issues create_folder_v2", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      // First writeCsv: create folder + upload
      () => json({ metadata: { path_display: "/Baseout-sp1/run_a" } }),
      () => json({ id: "f1", path_display: "/Baseout-sp1/run_a/a.csv" }),
      // deletePrefix
      () => json({ metadata: { path_display: "/Baseout-sp1/run_a" } }),
      // Second writeCsv after delete: MUST re-create the folder
      () => json({ metadata: { path_display: "/Baseout-sp1/run_a" } }),
      () => json({ id: "f2", path_display: "/Baseout-sp1/run_a/b.csv" }),
    ]);

    const writer = createDropboxWriter({ creds: makeCreds(), fetchImpl });
    await writer.writeCsv("run_a/a.csv", "a");
    await writer.deletePrefix("run_a");
    await writer.writeCsv("run_a/b.csv", "b");

    expect(calls).toHaveLength(5);
    expect(calls[3]!.url).toContain("/files/create_folder_v2");
  });
});
