// LocalFsReader — reads backup CSVs from the local-disk output produced by
// LocalFsWriter (storage-writers/local-fs.ts).
//
// Filed by openspec/changes/workflows-restore (section 1.2).
//
// KEY SCHEME: The writer calls writeCsvToLocalDisk(relativeKey, csv) which
// resolves to:
//   BACKUP_ROOT/<relativeKey>
// where BACKUP_ROOT = apps/workflows/.backups/ (from local-fs-write.ts).
// This reader reads from the SAME BACKUP_ROOT + relativeKey anchor, so a
// restore reads exactly what the backup wrote.
//
// Path-traversal guard mirrors the writer: segments containing `..` are
// rejected.

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

import type { StorageReader } from "./types";
import { BACKUP_ROOT } from "../local-fs-write";

export interface LocalFsReaderOptions {
  /**
   * Override the root directory. Tests pass a tmpdir; production omits this
   * and gets BACKUP_ROOT (apps/workflows/.backups/).
   */
  rootDir?: string;
}

function assertNoTraversal(key: string): void {
  if (key.includes("..")) {
    throw new Error("invalid_path");
  }
}

async function walkDir(dir: string, root: string): Promise<string[]> {
  const keys: string[] = [];
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    // Directory doesn't exist → no keys.
    return keys;
  }
  for (const name of names) {
    const fullPath = join(dir, name);
    let s: Awaited<ReturnType<typeof stat>>;
    try {
      s = await stat(fullPath);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      keys.push(...(await walkDir(fullPath, root)));
    } else {
      keys.push(relative(root, fullPath));
    }
  }
  return keys;
}

export class LocalFsReader implements StorageReader {
  private readonly rootDir: string;

  constructor(opts: LocalFsReaderOptions = {}) {
    this.rootDir = opts.rootDir ?? BACKUP_ROOT;
  }

  async init(): Promise<void> {
    // Verify root exists; non-fatal — a missing root means no backups yet.
    try {
      await stat(this.rootDir);
    } catch {
      // No backups directory yet — listKeys will return [] gracefully.
    }
  }

  async readFile(key: string): Promise<Buffer> {
    assertNoTraversal(key);
    const abs = join(this.rootDir, key);
    return readFile(abs);
  }

  async listKeys(prefix: string): Promise<string[]> {
    assertNoTraversal(prefix);
    const absPrefix = join(this.rootDir, prefix);
    const all = await walkDir(absPrefix, this.rootDir);
    return all.sort();
  }

  async cleanup(): Promise<void> {
    // No resources to release for local-fs.
  }
}
