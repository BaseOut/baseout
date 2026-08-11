// Unit tests for OneDriveWriter — fourth BYOS StorageWriter (Microsoft Graph).
//
// All Graph HTTP is mocked via a fake fetch that records calls and returns
// canned responses. Tests cover:
//   - happy writeCsv (folder lookup-then-create + createUploadSession + PUT)
//   - writeCsv path-traversal rejection
//   - happy writeBlob (size + content-type on the session PUT)
//   - writeBlob path-traversal rejection

import { describe, expect, it, vi } from "vitest";
import {
  createOneDriveWriter,
  type OneDriveWriterCreds,
} from "../../trigger/tasks/_lib/storage-writers/onedrive";

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
  overrides: Partial<OneDriveWriterCreds> = {},
): OneDriveWriterCreds {
  return {
    accessToken: "at_initial",
    expiresAt: FAR_FUTURE,
    providerFolderId: "root_item",
    refresh: vi.fn(async () => ({
      accessToken: "at_refreshed",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    })),
    ...overrides,
  };
}

describe("createOneDriveWriter.writeCsv", () => {
  it("looks up (miss) → creates each missing sub-folder, then uploads via session PUT", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      // 1. items lookup of "run_a" under root_item — 404 miss
      () => new Response("", { status: 404 }),
      // 2. create "run_a"
      () => json({ id: "folder_run_a", name: "run_a" }),
      // 3. items lookup of "base_x" — 404 miss
      () => new Response("", { status: 404 }),
      // 4. create "base_x"
      () => json({ id: "folder_base_x", name: "base_x" }),
      // 5. createUploadSession — returns uploadUrl
      () => json({ uploadUrl: "https://upload.test/session?id=abc" }),
      // 6. PUT bytes — 201 Created
      () => json({ id: "file_csv_id" }, { status: 201 }),
    ]);

    const writer = createOneDriveWriter({ creds: makeCreds(), fetchImpl });
    const csv = "a,b\n1,2\n";
    const result = await writer.writeCsv("run_a/base_x/tasks.csv", csv);

    expect(result.size).toBe(new TextEncoder().encode(csv).byteLength);
    expect(result.path).toBe("onedrive://folder_base_x/tasks.csv");

    // The session PUT used text/csv and went to the pre-authorized session URL.
    const putCall = calls[5]!;
    expect(putCall.url).toBe("https://upload.test/session?id=abc");
    expect(putCall.init.method).toBe("PUT");
    expect(new Headers(putCall.init.headers).get("content-type")).toBe(
      "text/csv",
    );
  });

  it("rejects relative keys containing `..`", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createOneDriveWriter({ creds: makeCreds(), fetchImpl });
    await expect(writer.writeCsv("../escape.csv", "x")).rejects.toThrow(
      "invalid_path",
    );
  });
});

describe("createOneDriveWriter.writeBlob", () => {
  it("uploads arbitrary bytes with the given content-type and returns the byte length", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      // 1. items lookup of "run_a" under root_item — 404 miss
      () => new Response("", { status: 404 }),
      // 2. create "run_a"
      () => json({ id: "folder_run_a", name: "run_a" }),
      // 3. createUploadSession — returns uploadUrl
      () => json({ uploadUrl: "https://upload.test/blob?id=def" }),
      // 4. PUT bytes — 200 OK
      () => json({ id: "file_blob_id" }),
    ]);

    const writer = createOneDriveWriter({ creds: makeCreds(), fetchImpl });
    const body = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]); // PNG-ish
    const result = await writer.writeBlob(
      "run_a/logo.png",
      body,
      "image/png",
    );

    expect(result.size).toBe(body.byteLength);
    expect(result.path).toBe("onedrive://folder_run_a/logo.png");

    // The session PUT carried the caller-supplied content-type and the bytes.
    const putCall = calls[3]!;
    expect(putCall.url).toBe("https://upload.test/blob?id=def");
    expect(putCall.init.method).toBe("PUT");
    expect(new Headers(putCall.init.headers).get("content-type")).toBe(
      "image/png",
    );
    expect(new Headers(putCall.init.headers).get("content-length")).toBe(
      String(body.byteLength),
    );
  });

  it("rejects relative keys containing `..`", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createOneDriveWriter({ creds: makeCreds(), fetchImpl });
    await expect(
      writer.writeBlob("../escape.png", new Uint8Array([1]), "image/png"),
    ).rejects.toThrow("invalid_path");
  });
});
