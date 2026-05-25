// Unit tests for GoogleDriveWriter — first cloud StorageWriter
// implementation (openspec/changes/shared-byos-drive Phase 4).
//
// All Drive HTTP is mocked via a fake fetch that records calls and returns
// canned responses. Tests cover:
//   - happy writeCsv (resumable upload session start + PUT bytes)
//   - sub-folder lookup-then-create caching across calls
//   - proactive refresh on near-expiry init
//   - reactive refresh on 401 mid-request
//   - path-traversal rejection
//   - deletePrefix happy path
//   - deletePrefix on missing path returns 0 (idempotent)
//   - deletePrefix on `..` rejected

import { describe, expect, it, vi } from "vitest";
import {
  createGoogleDriveWriter,
  type DriveWriterCreds,
} from "../../trigger/tasks/_lib/storage-writers/google-drive";

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

function makeCreds(overrides: Partial<DriveWriterCreds> = {}): DriveWriterCreds {
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

describe("createGoogleDriveWriter.writeCsv", () => {
  it("performs files.list (miss) → files.create for each missing sub-folder, then resumable upload", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      // 1. files.list for first segment "run_a" under root_folder — miss
      () => json({ files: [] }),
      // 2. files.create for "run_a"
      () => json({ id: "folder_run_a", name: "run_a" }),
      // 3. files.list for second segment "base_x" — miss
      () => json({ files: [] }),
      // 4. files.create for "base_x"
      () => json({ id: "folder_base_x", name: "base_x" }),
      // 5. upload init — 200 with Location header
      () =>
        new Response("", {
          status: 200,
          headers: { location: "https://upload.test/session?id=abc" },
        }),
      // 6. PUT bytes — 200
      () => json({ id: "file_csv_id" }),
    ]);

    const writer = createGoogleDriveWriter({
      creds: makeCreds(),
      fetchImpl,
    });
    const csv = "a,b\n1,2\n";
    const result = await writer.writeCsv("run_a/base_x/tasks.csv", csv);

    expect(result.size).toBe(new TextEncoder().encode(csv).byteLength);
    expect(result.path).toMatch(/^drive:\/\/folder_base_x\/tasks\.csv$/);

    // Listed-and-created twice (once per missing segment).
    const listCalls = calls.filter((c) => c.url.includes("drive/v3/files?q="));
    expect(listCalls.length).toBe(2);
    // Upload init carried metadata + content-type.
    const initCall = calls[4]!;
    expect(initCall.url).toContain("uploadType=resumable");
    expect(initCall.init.method).toBe("POST");
    // PUT to the session URL.
    const putCall = calls[5]!;
    expect(putCall.url).toBe("https://upload.test/session?id=abc");
    expect(putCall.init.method).toBe("PUT");
  });

  it("reuses cached sub-folder IDs across calls", async () => {
    // First write creates run_a/base_x. Second write should reuse them.
    const { fetchImpl, calls } = makeFakeFetch([
      // Call 1 — full lookup-then-create + upload (6 calls)
      () => json({ files: [] }),
      () => json({ id: "folder_run_a", name: "run_a" }),
      () => json({ files: [] }),
      () => json({ id: "folder_base_x", name: "base_x" }),
      () =>
        new Response("", {
          status: 200,
          headers: { location: "https://upload.test/sess1" },
        }),
      () => json({ id: "f1" }),
      // Call 2 — NO files.list / files.create; only upload init + PUT
      () =>
        new Response("", {
          status: 200,
          headers: { location: "https://upload.test/sess2" },
        }),
      () => json({ id: "f2" }),
    ]);

    const writer = createGoogleDriveWriter({
      creds: makeCreds(),
      fetchImpl,
    });
    await writer.writeCsv("run_a/base_x/tasks.csv", "x");
    await writer.writeCsv("run_a/base_x/items.csv", "y");

    // 6 calls for the first write + 2 for the second (no folder lookups)
    expect(calls.length).toBe(8);
  });

  it("proactively refreshes the access token when expiresAt is within 5 minutes", async () => {
    const nearExpiry = new Date(Date.now() + 60_000); // 1 minute away
    const refresh = vi.fn(async () => ({
      accessToken: "at_refreshed",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    }));
    const { fetchImpl, calls } = makeFakeFetch([
      // First Drive call — by now the writer should have already called refresh.
      () => json({ files: [{ id: "found_folder", name: "run_a" }] }),
      () => json({ files: [{ id: "found_folder_b", name: "base_x" }] }),
      () =>
        new Response("", {
          status: 200,
          headers: { location: "https://upload.test/sess" },
        }),
      () => json({ id: "f" }),
    ]);

    const writer = createGoogleDriveWriter({
      creds: makeCreds({ expiresAt: nearExpiry, refresh }),
      fetchImpl,
    });
    await writer.writeCsv("run_a/base_x/tasks.csv", "x");

    expect(refresh).toHaveBeenCalled();
    // First Drive call should have used the refreshed token.
    const authHeader = new Headers(calls[0]!.init.headers).get("authorization");
    expect(authHeader).toBe("Bearer at_refreshed");
  });

  it("reactively refreshes on 401 and retries the request once", async () => {
    const refresh = vi.fn(async () => ({
      accessToken: "at_refreshed",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    }));
    const { fetchImpl, calls } = makeFakeFetch([
      // First files.list returns 401
      () => new Response("", { status: 401 }),
      // Retry succeeds
      () => json({ files: [{ id: "found_folder", name: "run_a" }] }),
      () => json({ files: [{ id: "found_folder_b", name: "base_x" }] }),
      () =>
        new Response("", {
          status: 200,
          headers: { location: "https://upload.test/sess" },
        }),
      () => json({ id: "f" }),
    ]);

    const writer = createGoogleDriveWriter({
      creds: makeCreds({ refresh }),
      fetchImpl,
    });
    await writer.writeCsv("run_a/base_x/tasks.csv", "x");

    expect(refresh).toHaveBeenCalledTimes(1);
    // Retry call must use the new token.
    const retryAuth = new Headers(calls[1]!.init.headers).get("authorization");
    expect(retryAuth).toBe("Bearer at_refreshed");
  });

  it("rejects relative keys containing `..`", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createGoogleDriveWriter({
      creds: makeCreds(),
      fetchImpl,
    });
    await expect(writer.writeCsv("../escape.csv", "x")).rejects.toThrow(
      "invalid_path",
    );
  });
});

describe("createGoogleDriveWriter.deletePrefix", () => {
  it("walks the path, deletes the leaf folder recursively, returns deletedCount: 1", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      // Walk "run_a" — hit
      () => json({ files: [{ id: "folder_run_a", name: "run_a" }] }),
      // Walk "base_x" — hit
      () => json({ files: [{ id: "folder_base_x", name: "base_x" }] }),
      // listChildren of folder_base_x (paginated, returns one page)
      () => json({ files: [] }),
      // files.delete on folder_base_x (204 No Content — must use null body)
      () => new Response(null, { status: 204 }),
    ]);

    const writer = createGoogleDriveWriter({
      creds: makeCreds(),
      fetchImpl,
    });
    const result = await writer.deletePrefix("run_a/base_x/");

    expect(result.deletedCount).toBe(1);
    // Last call should be DELETE /drive/v3/files/folder_base_x
    expect(calls[calls.length - 1]!.url).toContain("/drive/v3/files/folder_base_x");
    expect(calls[calls.length - 1]!.init.method).toBe("DELETE");
  });

  it("returns deletedCount: 0 when prefix does not exist (idempotent)", async () => {
    const { fetchImpl } = makeFakeFetch([
      // First segment "run_a" — miss
      () => json({ files: [] }),
    ]);

    const writer = createGoogleDriveWriter({
      creds: makeCreds(),
      fetchImpl,
    });
    const result = await writer.deletePrefix("run_a/never-existed/");
    expect(result.deletedCount).toBe(0);
  });

  it("rejects relative prefixes containing `..`", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createGoogleDriveWriter({
      creds: makeCreds(),
      fetchImpl,
    });
    await expect(writer.deletePrefix("../escape/")).rejects.toThrow(
      "invalid_path",
    );
  });

  it("rejects an empty prefix (would delete the root folder)", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createGoogleDriveWriter({
      creds: makeCreds(),
      fetchImpl,
    });
    await expect(writer.deletePrefix("")).rejects.toThrow("invalid_path");
    await expect(writer.deletePrefix("/")).rejects.toThrow("invalid_path");
  });
});
