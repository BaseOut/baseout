// Tests for the resolveStorageWriter factory.
//
// Filed alongside the Drive writer (openspec/changes/shared-byos-drive
// Phase 4). The factory pins three behaviors:
//   - explicit local_fs → LocalFsWriter
//   - r2_managed (legacy) → LocalFsWriter
//   - google_drive WITH creds → GoogleDriveWriter
//   - google_drive WITHOUT creds → LocalFsWriter (defensive fallback)
//   - unknown storage type → LocalFsWriter

import { describe, expect, it, vi } from "vitest";
import {
  resolveStorageWriter,
  type StorageWriterCreds,
} from "../../trigger/tasks/_lib/storage-writers";
import { LocalFsWriter } from "../../trigger/tasks/_lib/storage-writers/local-fs";

function makeDriveCreds(): StorageWriterCreds {
  return {
    kind: "google_drive",
    accessToken: "at",
    expiresAt: new Date(Date.now() + 60 * 60_000),
    providerFolderId: "root_folder",
    refresh: vi.fn(async () => ({
      accessToken: "at_refreshed",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    })),
  };
}

describe("resolveStorageWriter", () => {
  it("returns LocalFsWriter for local_fs", () => {
    expect(resolveStorageWriter("local_fs")).toBeInstanceOf(LocalFsWriter);
  });

  it("returns LocalFsWriter for r2_managed (legacy default)", () => {
    expect(resolveStorageWriter("r2_managed")).toBeInstanceOf(LocalFsWriter);
  });

  it("returns LocalFsWriter when google_drive is requested but no creds are passed", () => {
    expect(resolveStorageWriter("google_drive")).toBeInstanceOf(LocalFsWriter);
  });

  it("returns LocalFsWriter for an unknown storage type", () => {
    expect(resolveStorageWriter("not_a_real_provider")).toBeInstanceOf(
      LocalFsWriter,
    );
  });

  it("returns a Drive-shaped writer when storage_type='google_drive' AND creds are present", () => {
    const writer = resolveStorageWriter("google_drive", makeDriveCreds());
    // GoogleDriveWriter is a factory return, not a class. Discriminate by
    // verifying it is NOT a LocalFsWriter and has the StorageWriter shape.
    expect(writer).not.toBeInstanceOf(LocalFsWriter);
    expect(typeof writer.writeCsv).toBe("function");
    expect(typeof writer.deletePrefix).toBe("function");
  });
});
