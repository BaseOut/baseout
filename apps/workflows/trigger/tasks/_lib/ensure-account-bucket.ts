// Lazy per-org managed R2 bucket (system-r2-bucket-topology 1.2).
//
// CreateBucket via the S3 API; BucketAlreadyOwnedByYou / 409 = success.
// Workflows has no DB layer — the caller records the name on the org row
// through an engine internal route (follow-up). This module is I/O + tests.

import { AwsClient } from "aws4fetch";
import { resolveManagedBucketName } from "./r2-bucket";
import type { R2WriterCreds } from "./storage-writers/r2";

export interface EnsureAccountBucketInput {
  env: string;
  organizationId: string;
  creds: Omit<R2WriterCreds, "bucket">;
  fetchImpl?: typeof fetch;
  endpoint?: string;
}

const OWNED = /BucketAlreadyOwnedByYou|BucketAlreadyExists|409/;

export async function ensureAccountBucket(
  input: EnsureAccountBucketInput,
): Promise<string> {
  const bucket = resolveManagedBucketName(
    input.env,
    input.organizationId.toLowerCase(),
  );
  const endpoint = (
    input.endpoint ?? `https://${input.creds.accountId}.r2.cloudflarestorage.com`
  ).replace(/\/$/, "");

  const fetchImpl: typeof fetch =
    input.fetchImpl ??
    (() => {
      const client = new AwsClient({
        accessKeyId: input.creds.accessKeyId,
        secretAccessKey: input.creds.secretAccessKey,
        region: "auto",
        service: "s3",
      });
      return client.fetch.bind(client) as unknown as typeof fetch;
    })();

  const res = await fetchImpl(`${endpoint}/${bucket}`, { method: "PUT" });
  if (res.ok || res.status === 409) return bucket;
  const body = await res.text();
  if (OWNED.test(body) || OWNED.test(String(res.status))) return bucket;
  throw new Error(`R2 CreateBucket failed (${res.status}): ${body.slice(0, 200)}`);
}
