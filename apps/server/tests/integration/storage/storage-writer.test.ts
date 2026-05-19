// Contract + factory-dispatch tests for the StorageWriter interface.
//
// Phase B.1 (shared-byos-drive-dropbox). At this phase the factory only knows
// the `r2_managed` branch — Drive + Dropbox cases land in Phase C.
//
// Tests in this file are pure (no R2 binding required). Miniflare-R2-backed
// tests for the R2-managed writer live in r2-managed.test.ts.

import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";

import {
  makeStorageWriter,
  type StorageDestination,
  type StorageWriter,
} from "../../../src/lib/storage/storage-writer";
import { R2ManagedWriter } from "../../../src/lib/storage/strategies/r2-managed";

const R2_DEST: StorageDestination = { type: "r2_managed" };

describe("makeStorageWriter", () => {
  it("returns an R2ManagedWriter for type 'r2_managed'", () => {
    const writer = makeStorageWriter(R2_DEST, env);
    expect(writer).toBeInstanceOf(R2ManagedWriter);
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

describe("StorageWriter contract (R2ManagedWriter)", () => {
  it("conforms to the StorageWriter shape", () => {
    const writer: StorageWriter = makeStorageWriter(R2_DEST, env);
    expect(typeof writer.init).toBe("function");
    expect(typeof writer.writeFile).toBe("function");
    expect(typeof writer.getDownloadUrl).toBe("function");
    expect(typeof writer.delete).toBe("function");
    // proxyStreamMode is optional — R2-managed does NOT proxy.
    expect(writer.proxyStreamMode ?? false).toBe(false);
  });
});
