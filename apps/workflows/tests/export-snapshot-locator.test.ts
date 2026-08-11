// TDD (CLAUDE.md §3.4) — RED first: locate each base's latest completed
// snapshot (shared-data-portability task 2.3, design D2/D3).
//
// The backup engine writes every table to
//   {orgSlug}/{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv
// (buildR2Key in _lib/r2-path.ts). The exporter is a *bundling* op: it reads
// the most recent run's CSVs rather than re-pulling Airtable, so it works even
// after the customer's Airtable connection is gone. This locator resolves, via
// an injected storage reader, the prefix of a base's latest snapshot run and
// the CSV keys under it — or null when the base has no completed snapshot.

import { describe, expect, it } from "vitest";
import {
  buildBasePrefix,
  locateLatestSnapshot,
  sanitizeSegment,
} from "../trigger/tasks/_lib/export-snapshot-locator";

// A minimal fake matching Pick<StorageReader, "listKeys">. Records the prefix
// it was asked for so we can assert the base-prefix contract.
function fakeReader(keys: string[]) {
  const calls: string[] = [];
  return {
    calls,
    listKeys: async (prefix: string) => {
      calls.push(prefix);
      return keys.filter((k) => k.startsWith(prefix));
    },
  };
}

describe("sanitizeSegment / buildBasePrefix", () => {
  it("replaces / in user-controlled names to block path nesting (mirrors r2-path)", () => {
    expect(sanitizeSegment("My/Space")).toBe("My_Space");
  });

  it("builds the per-base prefix WITHOUT a per-run DateTime segment", () => {
    expect(
      buildBasePrefix({ orgSlug: "acme", spaceName: "My/Space", baseName: "Pro/jects" }),
    ).toBe("acme/My_Space/Pro_jects/");
  });
});

describe("locateLatestSnapshot", () => {
  it("returns null when the base has no keys (no completed snapshot)", async () => {
    const reader = fakeReader([]);
    const located = await locateLatestSnapshot(reader, {
      orgSlug: "acme",
      spaceName: "Space",
      baseName: "Base",
    });
    expect(located).toBeNull();
    // Asked under the DateTime-less base prefix.
    expect(reader.calls).toEqual(["acme/Space/Base/"]);
  });

  it("picks the lexicographically-latest DateTime folder and returns its CSV keys", async () => {
    // Two runs; the DateTime format is fixed-width + year-first so lexicographic
    // max == chronological latest.
    const older = "acme/Space/Base/2026-05-01T09-00-00Z";
    const newer = "acme/Space/Base/2026-05-02T12-00-00Z";
    const reader = fakeReader([
      `${older}/Tasks.csv`,
      `${older}/People.csv`,
      `${newer}/Tasks.csv`,
      `${newer}/People.csv`,
    ]);
    const located = await locateLatestSnapshot(reader, {
      orgSlug: "acme",
      spaceName: "Space",
      baseName: "Base",
    });
    expect(located).not.toBeNull();
    expect(located!.prefix).toBe(`${newer}/`);
    expect(located!.dateTime).toBe("2026-05-02T12-00-00Z");
    // Reconstructed to a real ISO timestamp for the manifest (colons restored).
    expect(located!.snapshotAt).toBe("2026-05-02T12:00:00Z");
    expect(located!.keys.sort()).toEqual(
      [`${newer}/People.csv`, `${newer}/Tasks.csv`].sort(),
    );
  });

  it("ignores co-located attachments/ keys when choosing the snapshot", async () => {
    // buildAttachmentKey co-locates attachments under the base (no DateTime):
    //   {orgSlug}/{SpaceName}/{BaseName}/attachments/{compositeId}/{file}
    // A lexicographic scan must NOT mistake "attachments" for a DateTime folder.
    const snap = "acme/Space/Base/2026-05-02T12-00-00Z";
    const reader = fakeReader([
      `${snap}/Tasks.csv`,
      "acme/Space/Base/attachments/rec123_fld/photo.png",
    ]);
    const located = await locateLatestSnapshot(reader, {
      orgSlug: "acme",
      spaceName: "Space",
      baseName: "Base",
    });
    expect(located!.prefix).toBe(`${snap}/`);
    expect(located!.keys).toEqual([`${snap}/Tasks.csv`]);
  });

  it("returns only the .csv keys of the chosen snapshot (no stray files)", async () => {
    const snap = "acme/Space/Base/2026-05-02T12-00-00Z";
    const reader = fakeReader([
      `${snap}/Tasks.csv`,
      `${snap}/_manifest.txt`, // some non-CSV artifact under the run folder
    ]);
    const located = await locateLatestSnapshot(reader, {
      orgSlug: "acme",
      spaceName: "Space",
      baseName: "Base",
    });
    expect(located!.keys).toEqual([`${snap}/Tasks.csv`]);
  });
});
