// Path-layout helper for managed R2 backup output.
//
// Canonical layout per openspec/changes/baseout-server/specs/backup-engine/spec.md
// "Static backup file path layout":
//   /{user-root}/{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv
//
// `:` in the timestamp is replaced with `-` per the same spec's "Static path
// construction" scenario. Slashes in space/base/table names are replaced with
// `_` to prevent unintended R2 key nesting from user-controlled strings.
// orgSlug is server-controlled (already a slug) and passed through verbatim.

import { describe, expect, it } from "vitest";
import { buildAttachmentKey, buildR2Key } from "../trigger/tasks/_lib/r2-path";

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

  it("stays org-rooted for the default (byos) kind", () => {
    const base = {
      orgSlug: "acme",
      spaceName: "MySpace",
      baseName: "ProjectsDB",
      runStartedAt: new Date("2026-05-02T12:00:00Z"),
      tableName: "Tasks",
    };
    const expected = "acme/MySpace/ProjectsDB/2026-05-02T12-00-00Z/Tasks.csv";
    // kind absent === byos, byte-for-byte identical
    expect(buildR2Key(base)).toBe(expected);
    expect(buildR2Key({ ...base, kind: "byos" })).toBe(expected);
  });

  it("drops the org-root segment for managed_r2 (Space-rooted)", () => {
    const key = buildR2Key({
      orgSlug: "acme",
      spaceName: "MySpace",
      baseName: "ProjectsDB",
      runStartedAt: new Date("2026-05-02T12:00:00Z"),
      tableName: "Tasks",
      kind: "managed_r2",
    });
    expect(key).toBe("MySpace/ProjectsDB/2026-05-02T12-00-00Z/Tasks.csv");
  });

  it("keeps sanitization + timestamp handling for managed_r2", () => {
    const key = buildR2Key({
      orgSlug: "acme",
      spaceName: "My/Space",
      baseName: "Pro/jects",
      runStartedAt: new Date("2026-05-02T12:00:00.123Z"),
      tableName: "Ta/sks",
      kind: "managed_r2",
    });
    expect(key).toBe("My_Space/Pro_jects/2026-05-02T12-00-00Z/Ta_sks.csv");
  });
});

describe("buildAttachmentKey", () => {
  const base = {
    orgSlug: "acme",
    spaceName: "MySpace",
    baseName: "ProjectsDB",
    compositeId: "bas1_tbl1_rec1_fld1_att1",
    filename: "invoice.pdf",
  };

  it("stays org-rooted for the default (byos) kind", () => {
    const expected =
      "acme/MySpace/ProjectsDB/attachments/bas1_tbl1_rec1_fld1_att1/invoice.pdf";
    expect(buildAttachmentKey(base)).toBe(expected);
    expect(buildAttachmentKey({ ...base, kind: "byos" })).toBe(expected);
  });

  it("drops the org-root segment for managed_r2 (Space-rooted)", () => {
    const key = buildAttachmentKey({ ...base, kind: "managed_r2" });
    expect(key).toBe(
      "MySpace/ProjectsDB/attachments/bas1_tbl1_rec1_fld1_att1/invoice.pdf",
    );
  });

  it("keeps / sanitization for managed_r2", () => {
    const key = buildAttachmentKey({
      orgSlug: "acme",
      spaceName: "My/Space",
      baseName: "Pro/jects",
      compositeId: "bas1_tbl1_rec1_fld1_att1",
      filename: "sub/dir/invoice.pdf",
      kind: "managed_r2",
    });
    expect(key).toBe(
      "My_Space/Pro_jects/attachments/bas1_tbl1_rec1_fld1_att1/sub_dir_invoice.pdf",
    );
  });
});
