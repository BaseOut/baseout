// Pure-function tests for the storage-destination type resolution
// (shared-multi-destinations). A Space holds one storage_destinations row per
// provider type; the internal route picks WHICH row by:
//   1. an explicit ?type= from workflows (pins a run to its enqueue-time type),
//   2. else the Space's backup_configurations.storage_type (the primary),
//   3. else the legacy single-row lookup (null filter).

import { describe, expect, it } from "vitest";
import {
  parseTypeParam,
  resolveTypeFilter,
} from "../../src/lib/storage/resolve-destination-type";

describe("parseTypeParam", () => {
  it("accepts every known destination type", () => {
    for (const t of ["local_fs", "google_drive", "box", "dropbox", "onedrive"]) {
      expect(parseTypeParam(t)).toEqual({ ok: true, type: t });
    }
  });

  it("accepts an absent param as no filter", () => {
    expect(parseTypeParam(null)).toEqual({ ok: true, type: null });
  });

  it("rejects unknown types", () => {
    expect(parseTypeParam("evil")).toEqual({ ok: false });
    expect(parseTypeParam("r2_managed")).toEqual({ ok: false });
    expect(parseTypeParam("")).toEqual({ ok: false });
  });
});

describe("resolveTypeFilter", () => {
  it("prefers the explicit query type", () => {
    expect(resolveTypeFilter("box", "google_drive")).toBe("box");
  });

  it("falls back to the config's storage_type (the primary)", () => {
    expect(resolveTypeFilter(null, "google_drive")).toBe("google_drive");
  });

  it("uses the legacy single-row lookup when the config is r2_managed", () => {
    // r2_managed has no storage_destinations row — filtering by it would
    // always 404. Preserve the pre-multi-destination behavior instead.
    expect(resolveTypeFilter(null, "r2_managed")).toBeNull();
  });

  it("uses the legacy single-row lookup when no config exists", () => {
    expect(resolveTypeFilter(null, null)).toBeNull();
  });
});
