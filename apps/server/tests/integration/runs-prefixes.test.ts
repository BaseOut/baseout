// Tests for the buildRunPrefixes helper (Phase C.2 of
// openspec/changes/shared-backup-run-delete).
//
// The format is identical to buildR2Key minus the `<tableName>.csv` segment,
// with a trailing slash. Same sanitization rules apply (`/` → `_` in name
// segments, `:` → `-` in the ISO timestamp). One prefix per base in the
// run; the delete-run-files task fans out one writer.deletePrefix call per
// prefix.

import { describe, expect, it } from "vitest";
import { buildRunPrefixes } from "../../src/lib/runs/build-run-prefixes";

describe("buildRunPrefixes", () => {
  it("emits one prefix per base joined to the run", () => {
    const prefixes = buildRunPrefixes(
      [
        { orgSlug: "acme", spaceName: "MySpace", baseName: "Tasks" },
        { orgSlug: "acme", spaceName: "MySpace", baseName: "Projects" },
      ],
      new Date("2026-05-22T19:27:55.000Z"),
    );

    expect(prefixes).toEqual([
      "acme/MySpace/Tasks/2026-05-22T19-27-55Z/",
      "acme/MySpace/Projects/2026-05-22T19-27-55Z/",
    ]);
  });

  it("emits a single-element array for a single-base run", () => {
    const prefixes = buildRunPrefixes(
      [{ orgSlug: "acme", spaceName: "S", baseName: "B" }],
      new Date("2026-05-22T12:00:00Z"),
    );

    expect(prefixes).toEqual(["acme/S/B/2026-05-22T12-00-00Z/"]);
  });

  it("emits an empty array when no bases are joined", () => {
    const prefixes = buildRunPrefixes([], new Date("2026-05-22T12:00:00Z"));
    expect(prefixes).toEqual([]);
  });

  it("replaces `/` in space/base names with `_` to prevent nesting", () => {
    const prefixes = buildRunPrefixes(
      [{ orgSlug: "acme", spaceName: "Foo/Bar", baseName: "Quux/Quux" }],
      new Date("2026-05-22T12:00:00Z"),
    );

    expect(prefixes).toEqual(["acme/Foo_Bar/Quux_Quux/2026-05-22T12-00-00Z/"]);
  });

  it("strips subsecond precision from the timestamp segment", () => {
    const prefixes = buildRunPrefixes(
      [{ orgSlug: "acme", spaceName: "S", baseName: "B" }],
      new Date("2026-05-22T12:00:00.456Z"),
    );

    expect(prefixes).toEqual(["acme/S/B/2026-05-22T12-00-00Z/"]);
  });

  it("replaces `:` with `-` in the timestamp segment", () => {
    // Same rule as buildR2Key — `:` is illegal in some BYOS providers'
    // path segments and reads worse in file managers anyway.
    const prefixes = buildRunPrefixes(
      [{ orgSlug: "acme", spaceName: "S", baseName: "B" }],
      new Date("2026-05-22T12:34:56Z"),
    );

    expect(prefixes).toEqual(["acme/S/B/2026-05-22T12-34-56Z/"]);
  });

  it("preserves orgSlug verbatim (server-controlled, already a slug)", () => {
    const prefixes = buildRunPrefixes(
      [{ orgSlug: "org-with-uuid-like-3f5a", spaceName: "S", baseName: "B" }],
      new Date("2026-05-22T12:00:00Z"),
    );

    expect(prefixes[0]?.startsWith("org-with-uuid-like-3f5a/")).toBe(true);
  });

  it("every prefix ends with a trailing slash", () => {
    const prefixes = buildRunPrefixes(
      [
        { orgSlug: "acme", spaceName: "S1", baseName: "B1" },
        { orgSlug: "acme", spaceName: "S1", baseName: "B2" },
      ],
      new Date("2026-05-22T12:00:00Z"),
    );

    for (const p of prefixes) {
      expect(p.endsWith("/")).toBe(true);
    }
  });
});
