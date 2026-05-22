// LocalFsWriter — the only StorageWriter implementation on day one of
// openspec/changes/shared-backup-run-delete. Wraps node:fs.
//
// Writes delegate to the existing writeCsvToLocalDisk free function so the
// path-arithmetic anchor lives in exactly one place (BACKUP_ROOT in
// local-fs-write.ts, computed from ../../../ relative to that file's
// runtime location). Trigger.dev's bundler relocates these modules at
// build time; duplicating the anchor from a deeper file produced a
// one-level drift in earlier development.
//
// Deletes use the same imported BACKUP_ROOT + { recursive: true, force: true }
// so idempotency is built in — re-running deletePrefix against an
// already-gone prefix succeeds silently.
//
// Path-traversal guard preserved from the existing free function: segments
// containing `..` are rejected so on-disk paths stay unambiguous and a
// crafted relative key cannot escape BACKUP_ROOT.

import { rm } from "node:fs/promises";
import { join } from "node:path";

import type { StorageWriter } from "../storage-writer";
import { BACKUP_ROOT, writeCsvToLocalDisk } from "../local-fs-write";

export interface LocalFsWriterOptions {
  /**
   * Override the BACKUP_ROOT. Tests pass a tmpdir; production omits this
   * and gets the apps/workflows/.backups/ default (via BACKUP_ROOT).
   *
   * When provided, writeCsv falls back to a direct fs.writeFile call
   * (instead of delegating to the free function) so the override actually
   * takes effect. In production this branch is never taken.
   */
  rootDir?: string;
}

export class LocalFsWriter implements StorageWriter {
  private readonly rootDir: string | undefined;

  constructor(opts: LocalFsWriterOptions = {}) {
    this.rootDir = opts.rootDir;
  }

  async writeCsv(relativeKey: string, csv: string) {
    if (this.rootDir === undefined) {
      // Production path — delegate to the existing free function so the
      // BACKUP_ROOT anchor stays single-sourced.
      return writeCsvToLocalDisk(relativeKey, csv);
    }
    // Test path — write under the injected rootDir.
    if (relativeKey.includes("..")) {
      throw new Error("invalid_path");
    }
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname: pathDirname } = await import("node:path");
    const abs = join(this.rootDir, relativeKey);
    await mkdir(pathDirname(abs), { recursive: true });
    await writeFile(abs, csv, "utf8");
    return { path: abs, size: Buffer.byteLength(csv, "utf8") };
  }

  async deletePrefix(relativePrefix: string) {
    if (relativePrefix.includes("..")) {
      throw new Error("invalid_path");
    }
    const root = this.rootDir ?? BACKUP_ROOT;
    const abs = join(root, relativePrefix);
    await rm(abs, { recursive: true, force: true });
    return { deletedCount: 1 };
  }
}
