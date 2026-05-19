// R2-managed storage strategy.
//
// Phase B.2 (shared-byos-drive-dropbox). The `BACKUPS_R2` binding (restored
// in commit fbdc26e — Phase 0) is the managed-R2 destination. The workflows
// runner can't reach the binding directly (Node runner, no workerd), so this
// strategy is only callable from inside the engine Worker. The workflows-
// side counterpart will POST CSV chunks through the engine's R2 upload proxy
// route once OUT-5 (server-byos-r2-proxy-upload) ships.

import type { StorageWriter } from "../storage-writer";

const DEFAULT_MIME = "text/csv";
const SIGNED_URL_EXPIRY_SECONDS = 5 * 60;

export class R2ManagedWriter implements StorageWriter {
  readonly proxyStreamMode = false;

  constructor(private readonly bucket: R2Bucket) {}

  async init(): Promise<void> {
    // R2 has no per-run setup — buckets exist or they don't, and we don't
    // create them at write time.
  }

  async writeFile(
    stream: ReadableStream<Uint8Array>,
    path: string,
    mimeType: string = DEFAULT_MIME,
  ): Promise<{ destinationKey: string; sizeBytes: number }> {
    // workerd requires a known-length body. Buffer the stream into a single
    // ArrayBuffer before put. The current pageToCsv path already buffers a
    // whole table into memory before write — the row-by-row stream refactor
    // is OUT-10 / out of MVP scope.
    const body = await streamToArrayBuffer(stream);

    const result = await this.bucket.put(path, body, {
      httpMetadata: { contentType: mimeType },
    });

    if (!result) {
      throw new Error(`R2 put returned null for key ${path}`);
    }

    return {
      destinationKey: path,
      sizeBytes: result.size,
    };
  }

  getDownloadUrl(path: string): string {
    // MVP stub: the URL shape names the key + carries an expiry so the
    // StorageWriter contract is satisfied. The real signed URL lands when
    // the engine's R2 download-proxy route does (OUT-5 / server-restore-
    // from-byos OUT-9). Restore is out of scope for shared-byos-drive-
    // dropbox MVP smoke.
    const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_EXPIRY_SECONDS;
    return `r2://baseout-backups/${encodeURIComponent(path)}?expires=${expires}`;
  }

  async delete(path: string): Promise<void> {
    await this.bucket.delete(path);
  }
}

async function streamToArrayBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out.buffer;
}
