// Unit tests for the managed-R2 StorageWriter (openspec/changes/workflows-r2-writer).
//
// R2 is reached via its S3-compatible API on the Trigger.dev Node runner —
// NOT a Cloudflare Worker binding (see openspec/changes/system-r2-revive).
// SigV4 signing is aws4fetch's job; these tests inject a mock `fetchImpl`
// (bypassing signing) and assert request construction + response handling:
//   - writeCsv: PUT <endpoint>/<bucket>/<key>, text/csv, body bytes
//   - writeCsv non-2xx → throws with status
//   - deletePrefix: list-then-batch-delete, returns the deleted count
//   - deletePrefix on empty prefix → deletedCount 0 (idempotent)
//   - `..` path-traversal rejected on both writeCsv and deletePrefix

import { describe, expect, it } from "vitest";
import {
  createR2Writer,
  type R2WriterCreds,
} from "../../trigger/tasks/_lib/storage-writers/r2";

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

function xml(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/xml" },
    ...init,
  });
}

const CREDS: R2WriterCreds = {
  accountId: "acct123",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "secret",
  bucket: "baseout-backups",
};

const ENDPOINT = "https://acct123.r2.cloudflarestorage.com";

describe("createR2Writer.writeCsv", () => {
  it("PUTs the CSV bytes to <endpoint>/<bucket>/<key> with text/csv", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      () => new Response("", { status: 200 }),
    ]);
    const writer = createR2Writer({ creds: CREDS, fetchImpl });
    const csv = "a,b\n1,2\n";

    const res = await writer.writeCsv("acme/space/base/2026/Tasks.csv", csv);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.init.method).toBe("PUT");
    expect(calls[0]!.url).toBe(
      `${ENDPOINT}/baseout-backups/acme/space/base/2026/Tasks.csv`,
    );
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get("content-type")).toBe("text/csv");
    expect(res.path).toBe(
      "s3://baseout-backups/acme/space/base/2026/Tasks.csv",
    );
    expect(res.size).toBe(Buffer.byteLength(csv, "utf8"));
  });

  it("throws when the PUT is non-2xx", async () => {
    const { fetchImpl } = makeFakeFetch([
      () => new Response("AccessDenied", { status: 403 }),
    ]);
    const writer = createR2Writer({ creds: CREDS, fetchImpl });
    await expect(writer.writeCsv("a/b.csv", "x")).rejects.toThrow(/403/);
  });

  it("rejects a key with a `..` segment", async () => {
    const { fetchImpl, calls } = makeFakeFetch([]);
    const writer = createR2Writer({ creds: CREDS, fetchImpl });
    await expect(writer.writeCsv("a/../b.csv", "x")).rejects.toThrow(
      "invalid_path",
    );
    expect(calls).toHaveLength(0);
  });
});

describe("createR2Writer.writeBlob", () => {
  it("PUTs arbitrary bytes with the given content-type", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      () => new Response("", { status: 200 }),
    ]);
    const writer = createR2Writer({ creds: CREDS, fetchImpl });
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic

    const res = await writer.writeBlob(
      "acme/space/base/2026/attachments/abc/logo.png",
      bytes,
      "image/png",
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]!.init.method).toBe("PUT");
    expect(calls[0]!.url).toBe(
      `${ENDPOINT}/baseout-backups/acme/space/base/2026/attachments/abc/logo.png`,
    );
    expect(new Headers(calls[0]!.init.headers).get("content-type")).toBe(
      "image/png",
    );
    expect(res.path).toBe(
      "s3://baseout-backups/acme/space/base/2026/attachments/abc/logo.png",
    );
    expect(res.size).toBe(4);
  });

  it("rejects a key with a `..` segment", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createR2Writer({ creds: CREDS, fetchImpl });
    await expect(
      writer.writeBlob("a/../b.png", new Uint8Array([1]), "image/png"),
    ).rejects.toThrow("invalid_path");
  });
});

describe("createR2Writer.deletePrefix", () => {
  it("lists objects under the prefix then batch-deletes them", async () => {
    const listBody = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Contents><Key>acme/space/base/run1/Tasks.csv</Key></Contents>
  <Contents><Key>acme/space/base/run1/Items.csv</Key></Contents>
</ListBucketResult>`;
    const { fetchImpl, calls } = makeFakeFetch([
      // 1. ListObjectsV2
      () => xml(listBody),
      // 2. DeleteObjects (batch)
      () => xml("<DeleteResult></DeleteResult>"),
    ]);
    const writer = createR2Writer({ creds: CREDS, fetchImpl });

    const result = await writer.deletePrefix("acme/space/base/run1");

    expect(result.deletedCount).toBe(2);
    // List call
    expect(calls[0]!.init.method ?? "GET").toBe("GET");
    expect(calls[0]!.url).toContain("list-type=2");
    expect(calls[0]!.url).toContain("prefix=acme%2Fspace%2Fbase%2Frun1%2F");
    // Delete call
    expect(calls[1]!.init.method).toBe("POST");
    expect(calls[1]!.url).toContain("delete");
    expect(String(calls[1]!.init.body)).toContain(
      "acme/space/base/run1/Tasks.csv",
    );
  });

  it("returns deletedCount 0 without a delete call when the prefix is empty", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      () =>
        xml(
          `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult></ListBucketResult>`,
        ),
    ]);
    const writer = createR2Writer({ creds: CREDS, fetchImpl });

    const result = await writer.deletePrefix("never/existed");

    expect(result.deletedCount).toBe(0);
    expect(calls).toHaveLength(1); // list only, no delete
  });

  it("rejects a prefix with a `..` segment", async () => {
    const { fetchImpl } = makeFakeFetch([]);
    const writer = createR2Writer({ creds: CREDS, fetchImpl });
    await expect(writer.deletePrefix("../escape")).rejects.toThrow(
      "invalid_path",
    );
  });
});
