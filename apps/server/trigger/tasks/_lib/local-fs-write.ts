// Direct local-filesystem writer for backup-base CSVs.
//
// The backup-base task runs in Node (Trigger.dev runner), so we have
// node:fs available. CSVs land under apps/server/.backups/ at the relative
// path produced by buildR2Key (kept named "R2 key" for historical reasons —
// the string is now just a backup-tree-relative path).
//
// BACKUP_ROOT is anchored to this file's location so the destination is
// stable regardless of the Trigger.dev runner's cwd:
//   <this file>/../../../.backups → apps/server/.backups
//
// On a mid-run crash, partial CSVs are left in place; the backup_runs
// alarm safety net flips the run row out of `running`. Same posture the
// old R2 proxy had — no atomic-rename dance.
//
// Path-traversal guard preserved from the deleted upload-csv route:
// segment names with `..` are rejected so on-disk paths stay unambiguous.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BACKUP_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.backups",
);

export interface WriteCsvResult {
  path: string;
  size: number;
}

export async function writeCsvToLocalDisk(
  relativeKey: string,
  csv: string,
): Promise<WriteCsvResult> {
  if (relativeKey.includes("..")) {
    throw new Error("invalid_path");
  }
  const abs = join(BACKUP_ROOT, relativeKey);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, csv, "utf8");
  return { path: abs, size: Buffer.byteLength(csv, "utf8") };
}
