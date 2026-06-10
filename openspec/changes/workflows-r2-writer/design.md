# Design — workflows-r2-writer

## R2 via S3-compatible API on the Node runner

R2 exposes an S3-compatible endpoint at `https://<account_id>.r2.cloudflarestorage.com`. Auth is AWS SigV4 with an R2 API token rendered as an access-key-id / secret-access-key pair. Region is the literal string `auto`.

We sign with **`aws4fetch`** (`AwsClient`):

```ts
import { AwsClient } from "aws4fetch";

const client = new AwsClient({
  accessKeyId: creds.accessKeyId,
  secretAccessKey: creds.secretAccessKey,
  region: "auto",
  service: "s3",
});
const res = await client.fetch(`${endpoint}/${bucket}/${key}`, {
  method: "PUT",
  body: bytes,
  headers: { "content-type": "text/csv" },
});
```

### Why `aws4fetch`, not `@aws-sdk/client-s3`

- Zero runtime deps; ~a few KB. The workflows package currently has only `papaparse` + workspace packages — keep the bundle lean for the Trigger.dev build.
- Fetch-native: `AwsClient.fetch` is a drop-in for the `fetchImpl` seam every other writer already uses, so unit tests inject a mock `fetch` exactly as `google-drive.test.ts` does.
- `@aws-sdk/client-s3` is multi-MB and stream-API-oriented in a way that fights the existing test pattern.

### Writer shape (mirrors the existing writers)

```ts
export interface R2WriterCreds {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface CreateR2WriterOptions {
  creds: R2WriterCreds;
  /** Override for tests. Defaults to a fetch that signs via AwsClient. */
  fetchImpl?: typeof fetch;
  /** Override for tests. Defaults to https://<accountId>.r2.cloudflarestorage.com. */
  endpoint?: string;
}

export function createR2Writer(opts: CreateR2WriterOptions): StorageWriter
```

- `writeCsv` — `PUT <endpoint>/<bucket>/<key>`, `content-type: text/csv`, body = `new TextEncoder().encode(csv)`. Non-2xx → throw `r2 put <status>: <body slice>` (same error style as the Drive writer).
- `deletePrefix` — `GET <endpoint>/<bucket>?list-type=2&prefix=<prefix>/` → parse the XML `<Key>` entries → `POST <endpoint>/<bucket>?delete` with the batched delete XML body. Empty list → `{ deletedCount: 0 }`. The prefix is normalized to end with `/` so it can't match sibling keys.
- Path-traversal guard: reject any `relativeKey`/`relativePrefix` containing a `..` segment with `invalid_path`, identical to `LocalFsWriter`/`GoogleDriveWriter`.

### Test seam

`fetchImpl` defaults to a closure that builds the `AwsClient` once and calls `client.fetch`. Tests pass a mock `fetchImpl` and assert: method, URL (`<endpoint>/<bucket>/<key>`), `content-type`, body bytes. SigV4 correctness itself is `aws4fetch`'s responsibility — we don't re-test the AWS signing algorithm; we test our request construction and response handling.

## Cred plumbing — env, not OAuth

R2 is app-level, so it bypasses the per-Space OAuth path:

- `backup-base.ts` cred gate gains an `r2_managed` branch:
  ```ts
  } else if (input.storageType === "r2_managed") {
    const r2 = deps.getR2Creds?.() ?? null;
    storageCreds = r2 ? { kind: "r2", ...r2 } : undefined;
  }
  ```
  When `getR2Creds` returns `null` (dev without R2 provisioned), `storageCreds` is `undefined` and the factory falls back to `LocalFsWriter` — same graceful degradation the BYOS path already uses.
- `backup-base.task.ts` reads the four env vars and supplies `getR2Creds`. The hard guard (throw if `r2_managed` + missing env) lives in the task wrapper, not the pure function, so unit tests can exercise both the present-creds and absent-creds branches deterministically.

## Object-key layout

`buildR2Key` in `r2-path.ts` already produces `orgSlug/spaceName/baseName/<ts>/TableName.csv` with user-controlled segments sanitized. That string becomes the S3 object key verbatim. No layout change — only the destination changes from local disk to R2.
