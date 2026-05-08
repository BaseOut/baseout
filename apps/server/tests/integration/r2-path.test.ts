// Path-layout helper for managed R2 backup output.
//
// Canonical layout per openspec/changes/baseout-backup/specs/backup-engine/spec.md
// "Static backup file path layout":
//   /{user-root}/{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv
//
// `:` in the timestamp is replaced with `-` per the same spec's "Static path
// construction" scenario. Slashes in space/base/table names are replaced with
// `_` to prevent unintended R2 key nesting from user-controlled strings.
// orgSlug is server-controlled (already a slug) and passed through verbatim.

import { describe, expect, it } from "vitest";
import { buildR2Key } from "../../trigger/tasks/_lib/r2-path";

describe("buildR2Key", () => {
  it("matches the canonical static-path-construction scenario", () => {
    const key = buildR2Key({
      orgSlug: "acme",
      spaceName: "MySpace",
      baseName: "ProjectsDB",
      runStartedAt: new Date("2026-05-02T12:00:00Z"),
      tableName: "Tasks",
    });
    expect(key).toBe(
      "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/Tasks.csv",
    );
  });

  it("strips subsecond precision from the timestamp segment", () => {
    const key = buildR2Key({
      orgSlug: "acme",
      spaceName: "S",
      baseName: "B",
      runStartedAt: new Date("2026-05-02T12:00:00.123Z"),
      tableName: "T",
    });
    expect(key).toBe("acme/S/B/2026-05-02T12-00-00Z/T.csv");
  });

  it("replaces / in user-controlled segments to block path nesting", () => {
    const key = buildR2Key({
      orgSlug: "acme",
      spaceName: "My/Space",
      baseName: "Pro/jects",
      runStartedAt: new Date("2026-05-02T12:00:00Z"),
      tableName: "Ta/sks",
    });
    expect(key).toBe(
      "acme/My_Space/Pro_jects/2026-05-02T12-00-00Z/Ta_sks.csv",
    );
  });
});
