// Miniflare-R2 integration tests for the R2-managed storage strategy.
//
// Phase B.2 (shared-byos-drive-dropbox). The Cloudflare Vitest pool gives us
// an in-process R2 bucket bound at `env.BACKUPS_R2` (see wrangler.test.jsonc).
// Tests round-trip a small CSV-shaped buffer through put → list → head → get
// → delete to assert the writer matches the StorageWriter contract.

import { describe, expect, it, beforeEach } from "vitest";
import { env } from "cloudflare:test";

import { R2ManagedWriter } from "../../../src/lib/storage/strategies/r2-managed";

function streamFromString(s: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(s);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

const CSV_BODY = "id,name\n1,alice\n2,bob\n";

describe("R2ManagedWriter", () => {
  beforeEach(async () => {
    // Reset bucket between tests so writes from one test don't leak into the
    // next. Miniflare R2 persists across tests in the same isolate by default.
    const { objects } = await env.BACKUPS_R2.list({ limit: 1000 });
    await Promise.all(objects.map((o) => env.BACKUPS_R2.delete(o.key)));
  });

  it("init is a no-op (resolves without touching the bucket)", async () => {
    const writer = new R2ManagedWriter(env.BACKUPS_R2);
    await expect(writer.init()).resolves.toBeUndefined();
    const { objects } = await env.BACKUPS_R2.list({ limit: 10 });
    expect(objects).toHaveLength(0);
  });

  it("writeFile streams the buffer into R2 with the expected key + contentType + size", async () => {
    const writer = new R2ManagedWriter(env.BACKUPS_R2);
    const path = "space-abc/2026-05-19/people.csv";

    const result = await writer.writeFile(
      streamFromString(CSV_BODY),
      path,
      "text/csv",
    );

    expect(result.destinationKey).toBe(path);
    expect(result.sizeBytes).toBe(new TextEncoder().encode(CSV_BODY).byteLength);

    const obj = await env.BACKUPS_R2.head(path);
    expect(obj).not.toBeNull();
    expect(obj?.httpMetadata?.contentType).toBe("text/csv");
    expect(obj?.size).toBe(new TextEncoder().encode(CSV_BODY).byteLength);

    const body = await env.BACKUPS_R2.get(path);
    expect(await body?.text()).toBe(CSV_BODY);
  });

  it("writeFile defaults mimeType to text/csv when omitted", async () => {
    const writer = new R2ManagedWriter(env.BACKUPS_R2);
    await writer.writeFile(streamFromString(CSV_BODY), "default-mime.csv");
    const obj = await env.BACKUPS_R2.head("default-mime.csv");
    expect(obj?.httpMetadata?.contentType).toBe("text/csv");
  });

  it("getDownloadUrl returns a URL that names the key + expires within ~5 minutes", () => {
    const writer = new R2ManagedWriter(env.BACKUPS_R2);
    const path = "space-abc/2026-05-19/people.csv";

    const url = writer.getDownloadUrl(path);
    const parsed = new URL(url);

    // Path component must contain the key (URL-encoded is fine).
    expect(decodeURIComponent(parsed.pathname + parsed.search)).toContain(path);

    const expires = Number(parsed.searchParams.get("expires"));
    expect(Number.isFinite(expires)).toBe(true);
    const nowSec = Math.floor(Date.now() / 1000);
    expect(expires).toBeGreaterThan(nowSec);
    // 5 minutes plus a small slack for slow CI clocks.
    expect(expires).toBeLessThanOrEqual(nowSec + 5 * 60 + 10);
  });

  it("delete removes the object", async () => {
    const writer = new R2ManagedWriter(env.BACKUPS_R2);
    const path = "to-be-deleted.csv";

    await writer.writeFile(streamFromString(CSV_BODY), path);
    expect(await env.BACKUPS_R2.head(path)).not.toBeNull();

    await writer.delete(path);
    expect(await env.BACKUPS_R2.head(path)).toBeNull();
  });
});
