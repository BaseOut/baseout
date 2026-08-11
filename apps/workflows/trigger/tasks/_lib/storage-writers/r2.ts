// R2Writer — managed Cloudflare R2 StorageWriter for the Trigger.dev Node
// runner.
//
// Filed by openspec/changes/workflows-r2-writer, per the openspec/changes/
// system-r2-revive decision. R2 is reached via its S3-compatible API
// (https://<accountId>.r2.cloudflarestorage.com), NOT a Cloudflare Worker
// `BACKUPS_R2` binding — backups run on Trigger.dev's Node runner, which has
// no Workers bindings. Requests are SigV4-signed by aws4fetch; region is the
// literal "auto" for R2.
//
// Credentials are app-level env (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
// R2_SECRET_ACCESS_KEY / R2_BUCKET), supplied by the task wrapper — never
// per-Space OAuth, never the storage_destinations table.
//
// Path-traversal guard mirrors the other writers: a `..` segment in the key
// or prefix throws `invalid_path`.

import { AwsClient } from "aws4fetch";

import type { StorageWriter } from "../storage-writer";
import { toFetchBody } from "./fetch-body";

export interface R2WriterCreds {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface CreateR2WriterOptions {
  creds: R2WriterCreds;
  /**
   * Override for tests. Defaults to a fetch that SigV4-signs via aws4fetch.
   * Tests inject a mock that records calls and skips signing.
   */
  fetchImpl?: typeof fetch;
  /**
   * Override for tests. Defaults to
   * https://<accountId>.r2.cloudflarestorage.com.
   */
  endpoint?: string;
}

const MAX_DELETE_BATCH = 1000;

function assertNoTraversal(key: string): void {
  if (key.includes("..")) {
    throw new Error("invalid_path");
  }
}

function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function parseKeys(listXml: string): string[] {
  const keys: string[] = [];
  const re = /<Key>([^<]*)<\/Key>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(listXml)) !== null) {
    keys.push(m[1]!);
  }
  return keys;
}

function parseNextToken(listXml: string): string | undefined {
  const m = /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(
    listXml,
  );
  return m ? m[1] : undefined;
}

export function createR2Writer(opts: CreateR2WriterOptions): StorageWriter {
  const { creds } = opts;
  const endpoint = (
    opts.endpoint ?? `https://${creds.accountId}.r2.cloudflarestorage.com`
  ).replace(/\/$/, "");
  const bucketUrl = `${endpoint}/${creds.bucket}`;

  const fetchImpl: typeof fetch =
    opts.fetchImpl ??
    (() => {
      const client = new AwsClient({
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        region: "auto",
        service: "s3",
      });
      // aws4fetch's AwsClient.fetch SigV4-signs the request, then delegates to
      // global fetch. Bind + cast to `typeof fetch` — the signatures are
      // call-compatible for the (url, init) shape we use.
      return client.fetch.bind(client) as unknown as typeof fetch;
    })();

  async function listAllKeys(prefix: string): Promise<string[]> {
    const collected: string[] = [];
    let continuationToken: string | undefined;
    do {
      const url = new URL(bucketUrl);
      url.searchParams.set("list-type", "2");
      url.searchParams.set("prefix", prefix);
      if (continuationToken) {
        url.searchParams.set("continuation-token", continuationToken);
      }
      const res = await fetchImpl(url.toString(), { method: "GET" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`r2 list ${res.status}: ${body.slice(0, 200)}`);
      }
      const text = await res.text();
      collected.push(...parseKeys(text));
      continuationToken = parseNextToken(text);
    } while (continuationToken);
    return collected;
  }

  async function deleteBatch(keys: string[]): Promise<void> {
    const body = `<?xml version="1.0" encoding="UTF-8"?><Delete>${keys
      .map((k) => `<Object><Key>${escapeXml(k)}</Key></Object>`)
      .join("")}<Quiet>true</Quiet></Delete>`;
    const res = await fetchImpl(`${bucketUrl}?delete`, {
      method: "POST",
      headers: { "content-type": "application/xml" },
      body,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`r2 batch-delete ${res.status}: ${errText.slice(0, 200)}`);
    }
  }

  async function putObject(
    relativeKey: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<{ path: string; size: number }> {
    assertNoTraversal(relativeKey);
    const res = await fetchImpl(`${bucketUrl}/${relativeKey}`, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: toFetchBody(bytes),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`r2 put ${res.status}: ${body.slice(0, 200)}`);
    }
    return {
      path: `s3://${creds.bucket}/${relativeKey}`,
      size: bytes.byteLength,
    };
  }

  return {
    async writeCsv(relativeKey, csv) {
      return putObject(relativeKey, new TextEncoder().encode(csv), "text/csv");
    },

    async writeBlob(relativeKey, body, contentType) {
      return putObject(relativeKey, body, contentType);
    },

    async deletePrefix(relativePrefix) {
      assertNoTraversal(relativePrefix);
      // Normalize to a trailing slash so the prefix can't match sibling keys
      // (e.g. ".../run1" must not match ".../run1b/...").
      const prefix = `${relativePrefix.replace(/\/$/, "")}/`;
      const keys = await listAllKeys(prefix);
      if (keys.length === 0) {
        return { deletedCount: 0 };
      }
      for (let i = 0; i < keys.length; i += MAX_DELETE_BATCH) {
        await deleteBatch(keys.slice(i, i + MAX_DELETE_BATCH));
      }
      return { deletedCount: keys.length };
    },
  };
}
