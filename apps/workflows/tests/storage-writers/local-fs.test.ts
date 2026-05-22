// Unit tests for the workflows-side local-fs StorageWriter.
//
// Unlike Drive / Dropbox / Box this writer has no HTTP surface — it touches
// node:fs directly. Test seam = the `rootDir` constructor argument, which
// each test points at a fresh `tmpdir()` so suites don't collide. No
// fetchImpl mocking is needed.
//
// Coverage mirrors what the factory-dispatch tests already cover for
// Drive + Dropbox plus the legacy guarantees inherited verbatim from
// apps/workflows/trigger/tasks/_lib/local-fs-write.ts:
//   - string body writes UTF-8 bytes; destinationKey is the absolute path;
//     sizeBytes matches Buffer.byteLength(csv, "utf8")
//   - Uint8Array body writes raw bytes
//   - nested path triggers mkdir(..., { recursive: true })
//   - path-traversal guard: `..` in any segment rejects with
//     StorageWriteError of kind "bad_request"; nothing written
//   - proxyStreamMode === false
//   - init() is a no-op (does not touch fs)
//   - makeStorageWriter dispatch: type=local_fs returns a writer; the
//     refreshClient is never invoked
//   - regression guard: factory does NOT require accessToken or
//     providerFolderId for local_fs

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalFsWriter } from "../../trigger/tasks/_lib/storage-writers/local-fs";
import { makeStorageWriter } from "../../trigger/tasks/_lib/storage-writers";
import { StorageWriteError } from "../../trigger/tasks/_lib/storage-writers/types";

let rootDir: string;

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "baseout-localfs-"));
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe("createLocalFsWriter.writeFile (string body)", () => {
  it("writes UTF-8 bytes to <rootDir>/<path> and returns {destinationKey, sizeBytes}", async () => {
    const writer = createLocalFsWriter({ rootDir });
    const csv = "col,1\ncol,2\n";

    const result = await writer.writeFile(csv, "org/space/run/base/table.csv");

    const expectedAbs = join(rootDir, "org/space/run/base/table.csv");
    expect(result.destinationKey).toBe(expectedAbs);
    expect(result.sizeBytes).toBe(Buffer.byteLength(csv, "utf8"));

    const onDisk = await readFile(expectedAbs, "utf8");
    expect(onDisk).toBe(csv);
  });
});

describe("createLocalFsWriter.writeFile (Uint8Array body)", () => {
  it("writes raw bytes verbatim", async () => {
    const writer = createLocalFsWriter({ rootDir });
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69]); // BOM + "hi"

    const result = await writer.writeFile(bytes, "raw/file.bin");

    const expectedAbs = join(rootDir, "raw/file.bin");
    expect(result.destinationKey).toBe(expectedAbs);
    expect(result.sizeBytes).toBe(5);

    const onDisk = await readFile(expectedAbs);
    expect(new Uint8Array(onDisk)).toEqual(bytes);
  });
});

describe("createLocalFsWriter.writeFile (nested path)", () => {
  it("creates intermediate directories with mkdir({recursive:true})", async () => {
    const writer = createLocalFsWriter({ rootDir });

    await writer.writeFile("x", "a/b/c/d/e/f/table.csv");

    const parentDir = join(rootDir, "a/b/c/d/e/f");
    const stats = await stat(parentDir);
    expect(stats.isDirectory()).toBe(true);
  });
});

describe("createLocalFsWriter.writeFile (path-traversal guard)", () => {
  it("rejects when path contains '..' and writes nothing", async () => {
    const writer = createLocalFsWriter({ rootDir });

    await expect(
      writer.writeFile("x", "../escape.csv"),
    ).rejects.toMatchObject({
      name: "StorageWriteError",
      kind: "bad_request",
    });

    // The would-be parent (rootDir) still exists, but the escape file
    // must not have been written next to it.
    await expect(stat(join(rootDir, "../escape.csv"))).rejects.toThrow();
  });

  it("rejects even when '..' is a substring of a benign-looking segment", async () => {
    // The legacy local-fs-write.ts uses `path.includes("..")`, which is
    // intentionally over-strict. Preserve verbatim.
    const writer = createLocalFsWriter({ rootDir });

    await expect(
      writer.writeFile("x", "org/foo..bar/table.csv"),
    ).rejects.toMatchObject({
      kind: "bad_request",
    });
  });
});

describe("createLocalFsWriter.proxyStreamMode", () => {
  it("is false (local writes do not proxy)", () => {
    const writer = createLocalFsWriter({ rootDir });
    expect(writer.proxyStreamMode).toBe(false);
  });
});

describe("createLocalFsWriter.init", () => {
  it("is a no-op and does not touch fs (safe with non-existent rootDir)", async () => {
    // Point at a path that does NOT exist. init() must not throw or create it.
    const writer = createLocalFsWriter({
      rootDir: join(rootDir, "definitely/does/not/exist"),
    });

    await writer.init();

    await expect(
      stat(join(rootDir, "definitely/does/not/exist")),
    ).rejects.toThrow();
  });
});

describe("makeStorageWriter dispatch (local_fs)", () => {
  it("builds a local-fs writer for type=local_fs", () => {
    const refreshClient = vi.fn();
    const writer = makeStorageWriter(
      { type: "local_fs" },
      { refreshClient },
    );

    expect(typeof writer.writeFile).toBe("function");
    expect(writer.proxyStreamMode).toBe(false);
  });

  it("does NOT require accessToken / providerFolderId for local_fs", () => {
    // Regression guard: a copy-paste of the Drive / Dropbox credential
    // checks would incorrectly reject local-fs destinations.
    const refreshClient = vi.fn();
    expect(() =>
      makeStorageWriter({ type: "local_fs" }, { refreshClient }),
    ).not.toThrow();
  });

  it("never invokes refreshClient (local_fs has no credentials)", async () => {
    const refreshClient = vi.fn();
    const writer = makeStorageWriter(
      { type: "local_fs" },
      { refreshClient },
    );

    await writer.init();
    await writer.writeFile("x", "smoke.csv").catch(() => {
      // The factory-built writer points at the default root (apps/workflows
      // /.backups/). The write may succeed or fail depending on host fs
      // permissions, but either way refreshClient must not be called.
    });

    expect(refreshClient).not.toHaveBeenCalled();
  });
});
