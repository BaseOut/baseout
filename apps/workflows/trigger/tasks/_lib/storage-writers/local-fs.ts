// Workflows-side local-fs StorageWriter.
//
// First-class member of the StorageWriter abstraction (alongside Drive,
// Dropbox, Box) — dispatched from ./index.ts when a Space's
// storage_destinations row has type='local_fs'. The engine auto-provisions
// a local_fs row for Spaces with no OAuth-connected destination so dev
// smokes work end-to-end without a third-party Connect step (see
// openspec/changes/system-local-fs-dev-writer).
//
// Mechanics ported verbatim from the legacy
// apps/workflows/trigger/tasks/_lib/local-fs-write.ts so existing callers
// of the writeCsv? seam on backup-base.ts continue to write under the same
// tree. Default rootDir resolves to apps/workflows/.backups (same root).
// The legacy module is kept until Phase W.2 of shared-byos-drive-dropbox
// replaces backup-base.ts's writeCsv? seam with makeStorageWriter().

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  StorageWriteError,
  type StorageWriter,
  type WriteResult,
} from "./types";

// `./local-fs.ts` is nested one directory deeper than `local-fs-write.ts`,
// so the `..` count is four (storage-writers → _lib → tasks → trigger).
const DEFAULT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../.backups",
);

export interface LocalFsWriterOptions {
  /** Override the backup root directory (tests). Defaults to apps/workflows/.backups. */
  rootDir?: string;
}

export function createLocalFsWriter(
  opts: LocalFsWriterOptions = {},
): StorageWriter {
  const rootDir = opts.rootDir ?? DEFAULT_ROOT;

  function toBytes(body: Uint8Array | string): Uint8Array {
    return typeof body === "string" ? new TextEncoder().encode(body) : body;
  }

  return {
    proxyStreamMode: false,

    async init() {
      // No-op. No credentials, no upload session to warm. The rootDir is
      // created lazily on the first writeFile() via mkdir({recursive:true}).
    },

    async writeFile(
      body: Uint8Array | string,
      path: string,
      _mimeType?: string,
    ): Promise<WriteResult> {
      // Path-traversal guard preserved verbatim from local-fs-write.ts —
      // a substring `..` match is intentionally over-strict. Rejecting any
      // segment with `..` keeps on-disk paths unambiguous.
      if (path.includes("..")) {
        throw new StorageWriteError("bad_request", "invalid_path");
      }

      const bytes = toBytes(body);
      const abs = join(rootDir, path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, bytes);

      return { destinationKey: abs, sizeBytes: bytes.byteLength };
    },
  };
}
