// R2Reader — reads backup objects from managed Cloudflare R2.
//
// Filed by openspec/changes/workflows-restore (section 1.2).
//
// KEY SCHEME: The writer (storage-writers/r2.ts) uses the S3-compatible API
// to PUT objects at:
//   https://<accountId>.r2.cloudflarestorage.com/<bucket>/<relativeKey>
// where relativeKey is produced by buildR2Key() in r2-path.ts:
//   <orgSlug>/<spaceName>/<baseName>/<timestamp>/<tableName>.csv
//
// This reader GETs from the SAME endpoint + key, and lists using the S3
// list-objects-v2 protocol (same as the writer's delete path). The SigV4
// signing via aws4fetch mirrors r2.ts exactly.
//
// Path-traversal guard mirrors the other readers/writers.

import { AwsClient } from "aws4fetch";

import type { StorageReader } from "./types";

export interface R2ReaderCreds {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface CreateR2ReaderOptions {
  creds: R2ReaderCreds;
  /**
   * Override for tests. Defaults to SigV4-signed fetch via aws4fetch.
   */
  fetchImpl?: typeof fetch;
  /**
   * Override for tests. Defaults to
   * https://<accountId>.r2.cloudflarestorage.com
   */
  endpoint?: string;
}

function assertNoTraversal(key: string): void {
  if (key.includes("..")) {
    throw new Error("invalid_path");
  }
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

export function createR2Reader(opts: CreateR2ReaderOptions): StorageReader {
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

  return {
    async init() {
      // No credential pre-check needed; errors surface on first real call.
    },

    async readFile(key: string) {
      assertNoTraversal(key);
      const res = await fetchImpl(`${bucketUrl}/${key}`, { method: "GET" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`r2 get ${res.status}: ${body.slice(0, 200)}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },

    async listKeys(prefix: string) {
      assertNoTraversal(prefix);
      // Normalize to trailing slash so the prefix matches only its subtree,
      // not sibling keys (mirrors the deletePrefix convention in r2.ts).
      const normalizedPrefix = `${prefix.replace(/\/$/, "")}/`;
      const keys = await listAllKeys(normalizedPrefix);
      return keys.sort();
    },

    async cleanup() {
      // No persistent connection to close.
    },
  };
}
