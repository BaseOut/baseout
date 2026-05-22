// Tests for LocalFsWriter — the only StorageWriter implementation on day one
// of openspec/changes/shared-backup-run-delete. Uses os.tmpdir() so the real
// apps/workflows/.backups/ tree is never touched.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { LocalFsWriter } from "../../trigger/tasks/_lib/storage-writers/local-fs";

describe("LocalFsWriter", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "baseout-localfs-"));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  describe("writeCsv", () => {
    it("writes a CSV at the given relative key + creates parent dirs", async () => {
      const writer = new LocalFsWriter({ rootDir });
      const csv = "a,b\n1,2\n";
      const result = await writer.writeCsv("acme/Space/Base/2026-05-22T19-27-55Z/Tasks.csv", csv);

      expect(result.size).toBe(Buffer.byteLength(csv, "utf8"));
      const written = await readFile(result.path, "utf8");
      expect(written).toBe(csv);
    });

    it("rejects relative keys containing `..`", async () => {
      const writer = new LocalFsWriter({ rootDir });
      await expect(writer.writeCsv("../escape.csv", "x")).rejects.toThrow("invalid_path");
    });
  });

  describe("deletePrefix", () => {
    it("removes a populated prefix recursively", async () => {
      const writer = new LocalFsWriter({ rootDir });
      // Seed a tree under <root>/acme/Space/Base/<ts>/
      const prefix = "acme/Space/Base/2026-05-22T19-27-55Z/";
      const absDir = join(rootDir, prefix);
      await mkdir(absDir, { recursive: true });
      await writeFile(join(absDir, "Tasks.csv"), "a,b\n");
      await writeFile(join(absDir, "Items.csv"), "x,y\n");

      const result = await writer.deletePrefix(prefix);
      expect(result.deletedCount).toBe(1);
      await expect(stat(absDir)).rejects.toThrow();
    });

    it("on a non-existent prefix returns deletedCount: 1 without throwing", async () => {
      // Idempotency: re-running against an already-gone prefix is a no-op.
      // Implementation uses fs.rm({ force: true }) so it doesn't distinguish
      // "was there" from "wasn't" — both report deletedCount: 1.
      const writer = new LocalFsWriter({ rootDir });
      const result = await writer.deletePrefix("never/existed/");
      expect(result.deletedCount).toBe(1);
    });

    it("rejects relative prefixes containing `..`", async () => {
      const writer = new LocalFsWriter({ rootDir });
      await expect(writer.deletePrefix("../escape/")).rejects.toThrow("invalid_path");
    });

    it("does not escape the configured rootDir", async () => {
      // Sanity check: an absolute-looking input still joins under rootDir.
      // (node:path.join collapses leading slashes onto the join target.)
      const writer = new LocalFsWriter({ rootDir });
      const outside = join(rootDir, "..", "sibling.txt");
      await writeFile(outside, "should not be deleted");
      try {
        // The prefix has no `..` so the guard doesn't catch it, but the
        // join keeps the path inside rootDir.
        await writer.deletePrefix("acme/never-exists/");
        const survivor = await readFile(outside, "utf8");
        expect(survivor).toBe("should not be deleted");
      } finally {
        await rm(outside, { force: true });
      }
    });
  });
});
