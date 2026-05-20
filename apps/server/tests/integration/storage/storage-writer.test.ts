// Contract + factory-dispatch tests for the StorageWriter interface.
//
// Per openspec/changes/system-r2-park, managed R2 is paused: the factory
// throws for `r2_managed`. Drive + Dropbox cases throw until Phase C of
// shared-byos-drive-dropbox lands. The contract-shape test reactivates when
// the first BYOS strategy ships.

import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";

import {
  makeStorageWriter,
  type StorageDestination,
} from "../../../src/lib/storage/storage-writer";

describe("makeStorageWriter", () => {
  it("throws for 'r2_managed' per system-r2-park", () => {
    const dest: StorageDestination = { type: "r2_managed" };
    expect(() => makeStorageWriter(dest, env)).toThrow(/system-r2-park/);
  });

  it("throws for 'google_drive' until Phase C lands", () => {
    const dest: StorageDestination = { type: "google_drive" };
    expect(() => makeStorageWriter(dest, env)).toThrow(/google_drive/);
  });

  it("throws for 'dropbox' until Phase C lands", () => {
    const dest: StorageDestination = { type: "dropbox" };
    expect(() => makeStorageWriter(dest, env)).toThrow(/dropbox/);
  });

  it("throws for an unknown destination type", () => {
    expect(() =>
      makeStorageWriter(
        // Force an unsupported value past the union to assert the runtime
        // guard catches what the type-system can't (e.g. a stale DB row).
        { type: "unsupported_yet" } as unknown as StorageDestination,
        env,
      ),
    ).toThrow(/unsupported_yet/);
  });
});
