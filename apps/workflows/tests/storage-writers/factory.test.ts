// Tests for the resolveStorageWriter factory.
//
// Filed alongside the Drive writer (openspec/changes/shared-byos-drive
// Phase 4); extended by the box-provider commit chain (3/3). The factory
// pins these behaviors:
//   - explicit local_fs → LocalFsWriter
//   - r2_managed (legacy) → LocalFsWriter
//   - google_drive WITH creds → GoogleDriveWriter
//   - google_drive WITHOUT creds → LocalFsWriter (defensive fallback)
//   - box WITH creds → BoxWriter
//   - box WITHOUT creds → LocalFsWriter (defensive fallback)
//   - cross-kind creds (e.g. storage_type='box' but kind='google_drive') →
//     LocalFsWriter (kind must match the storage_type the user picked)
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

function makeBoxCreds(): StorageWriterCreds {
  return {
    kind: "box",
    accessToken: "at",
    expiresAt: new Date(Date.now() + 60 * 60_000),
    providerFolderId: "box_folder_42",
    refresh: vi.fn(async () => ({
      accessToken: "at_refreshed",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    })),
  };
}

function makeDropboxCreds(): StorageWriterCreds {
  return {
    kind: "dropbox",
    accessToken: "sl.at",
    expiresAt: new Date(Date.now() + 60 * 60_000),
    providerFolderId: "/Baseout-sp1",
    refresh: vi.fn(async () => ({
      accessToken: "sl.at_refreshed",
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

  it("returns LocalFsWriter when box is requested but no creds are passed", () => {
    expect(resolveStorageWriter("box")).toBeInstanceOf(LocalFsWriter);
  });

  it("returns LocalFsWriter when dropbox is requested but no creds are passed", () => {
    expect(resolveStorageWriter("dropbox")).toBeInstanceOf(LocalFsWriter);
  });

  it("returns LocalFsWriter for an unknown storage type", () => {
    expect(resolveStorageWriter("not_a_real_provider")).toBeInstanceOf(
      LocalFsWriter,
    );
  });

  it("returns a Drive-shaped writer when storage_type='google_drive' AND creds are present", () => {
    const writer = resolveStorageWriter("google_drive", makeDriveCreds());
    expect(writer).not.toBeInstanceOf(LocalFsWriter);
    expect(typeof writer.writeCsv).toBe("function");
    expect(typeof writer.deletePrefix).toBe("function");
  });

  it("returns a Box-shaped writer when storage_type='box' AND creds.kind='box' are present", () => {
    const writer = resolveStorageWriter("box", makeBoxCreds());
    expect(writer).not.toBeInstanceOf(LocalFsWriter);
    expect(typeof writer.writeCsv).toBe("function");
    expect(typeof writer.deletePrefix).toBe("function");
  });

  it("returns a Dropbox-shaped writer when storage_type='dropbox' AND creds.kind='dropbox' are present", () => {
    const writer = resolveStorageWriter("dropbox", makeDropboxCreds());
    expect(writer).not.toBeInstanceOf(LocalFsWriter);
    expect(typeof writer.writeCsv).toBe("function");
    expect(typeof writer.deletePrefix).toBe("function");
  });

  it("falls back to LocalFsWriter on cross-kind creds (storage_type='box' but kind='google_drive', etc.)", () => {
    // The user picked one provider but the engine returned a different
    // provider's creds — that's a bug in the upstream flow; the safe
    // response is to write locally rather than send data to the wrong
    // provider's API.
    expect(resolveStorageWriter("box", makeDriveCreds())).toBeInstanceOf(
      LocalFsWriter,
    );
    expect(
      resolveStorageWriter("google_drive", makeBoxCreds()),
    ).toBeInstanceOf(LocalFsWriter);
    expect(
      resolveStorageWriter("dropbox", makeBoxCreds()),
    ).toBeInstanceOf(LocalFsWriter);
    expect(
      resolveStorageWriter("dropbox", makeDriveCreds()),
    ).toBeInstanceOf(LocalFsWriter);
    expect(
      resolveStorageWriter("box", makeDropboxCreds()),
    ).toBeInstanceOf(LocalFsWriter);
  });
});
